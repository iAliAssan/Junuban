import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CartService } from "../cart/cart.service";
import { AddressesService } from "../addresses/addresses.service";
import { availablePackages } from "../catalog/inventory.util";
import { calculateShippingCost } from "./shipping.util";
import { formatOrderNumber, randomOrderSuffix } from "./order-number.util";
import { isValidOrderStatusTransition, type OrderStatus } from "./order-status.util";
import { PaymentProviderFactory } from "./payment/payment-provider.factory";
import { normalizeIranianMobile } from "../auth/otp/phone.util";
import type { AppConfig } from "../config/configuration";
import type { CheckoutDto } from "./dto/checkout.dto";
import type { AddressFieldsDto } from "../addresses/dto/address-fields.dto";
import type { Prisma } from "@prisma/client";

const ORDER_INCLUDE = {
  items: true,
  statusHistory: { orderBy: { createdAt: "asc" } },
  paymentAttempts: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly addresses: AddressesService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly paymentProviders: PaymentProviderFactory,
  ) {}

  /**
   * Creates an order from the current cart. This is the single
   * transactional heart of the store — see IMPLEMENTATION_STATUS.md for
   * the full step list. Safe to call twice with the same
   * `idempotencyKey` (returns the already-created order instead of
   * creating a duplicate).
   */
  async checkout(
    cartId: string,
    dto: CheckoutDto,
    customerId: string | null,
  ): Promise<{ order: OrderWithRelations; paymentInstructions?: string; redirectUrl?: string }> {
    // Idempotent replay: if this exact checkout attempt already produced
    // an order, return it rather than creating a second one.
    const existing = await this.prisma.order.findUnique({
      where: { checkoutIdempotencyKey: dto.idempotencyKey },
      include: ORDER_INCLUDE,
    });
    if (existing) {
      return { order: existing };
    }

    if (!customerId && !dto.guestPhone) {
      throw new BadRequestException("برای ثبت سفارش مهمان، شماره موبایل الزامی است");
    }

    const shippingAddress = await this.resolveShippingAddress(dto, customerId);

    const cartView = await this.cart.getCart(cartId);
    if (cartView.items.length === 0) {
      throw new BadRequestException("سبد خرید شما خالی است");
    }

    const unavailable = cartView.items.filter((i) => i.hasAvailabilityIssue);
    if (unavailable.length > 0) {
      throw new BadRequestException(
        `موجودی برخی کالاها کافی نیست: ${unavailable.map((i) => i.productName).join("، ")}`,
      );
    }

    const shippingConfig = this.config.get("shipping", { infer: true });
    const subtotal = cartView.subtotal;
    const shippingCost = calculateShippingCost(subtotal, shippingConfig);
    const total = subtotal + shippingCost;

    const order = await this.prisma.runSerializable(async (tx) => {
      // ---- 1. Re-validate + atomically reserve inventory per line ----
      // Re-reads live variant/inventory state inside the same serializable
      // transaction as the cart snapshot above, so a concurrent checkout
      // racing for the same stock is caught by Postgres's serialization
      // failure detection (see PrismaService.runSerializable) rather than
      // trusted from the earlier, now-possibly-stale cart read.
      const reservationInputs: { variantId: string; quantity: number; grams: number }[] = [];

      for (const item of cartView.items) {
        const variant = await tx.variant.findFirst({
          where: { id: item.variantId, isActive: true },
          include: { weightOption: true, productProducer: { include: { inventory: true } } },
        });
        if (!variant) {
          throw new BadRequestException(`محصول «${item.productName}» دیگر در دسترس نیست`);
        }

        const inventory = variant.productProducer.inventory;
        const available = availablePackages(
          inventory?.onHandGrams ?? 0,
          inventory?.reservedGrams ?? 0,
          variant.weightOption.grams,
        );
        if (available < item.quantity) {
          throw new BadRequestException(
            available === 0
              ? `«${item.productName}» دیگر موجود نیست`
              : `تنها ${available} بسته از «${item.productName}» موجود است`,
          );
        }

        const grams = variant.weightOption.grams * item.quantity;
        await tx.inventory.update({
          where: { productProducerId: variant.productProducerId },
          data: { reservedGrams: { increment: grams } },
        });
        reservationInputs.push({ variantId: item.variantId, quantity: item.quantity, grams });
      }

      // ---- 2. Generate a unique, human-readable order number ----
      let orderNumber = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = formatOrderNumber(randomOrderSuffix());
        const collision = await tx.order.findUnique({ where: { orderNumber: candidate } });
        if (!collision) {
          orderNumber = candidate;
          break;
        }
      }
      if (!orderNumber) {
        throw new Error("امکان تولید شماره سفارش یکتا وجود نداشت — لطفاً دوباره تلاش کنید");
      }

      // ---- 3. Create the order + item snapshots (never re-derived later) ----
      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId: customerId ?? undefined,
          guestEmail: customerId ? undefined : dto.guestEmail,
          guestPhone: customerId ? undefined : dto.guestPhone,
          status: "PENDING_PAYMENT",
          subtotal,
          shippingCost,
          total,
          shippingAddress: { ...shippingAddress },
          checkoutIdempotencyKey: dto.idempotencyKey,
          customerNote: dto.customerNote?.trim() || undefined,
          items: {
            create: cartView.items.map((item) => ({
              variantId: item.variantId,
              packagingOptionId: item.packagingOptionId ?? undefined,
              productNameSnapshot: item.productName,
              producerNameSnapshot: item.producerName,
              weightLabelSnapshot: item.weightLabel,
              packagingNameSnapshot: item.packagingName ?? undefined,
              unitPriceSnapshot: item.unitPrice,
              packagingPriceSnapshot: item.packagingPriceDelta,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });

      // ---- 4. Record the reservations against the now-known order ----
      const reservationTtlMinutes = this.config.get("inventory", { infer: true }).reservationTtlMinutes;
      const expiresAt = new Date(Date.now() + reservationTtlMinutes * 60 * 1000);
      await tx.inventoryReservation.createMany({
        data: reservationInputs.map((r) => ({
          variantId: r.variantId,
          orderId: created.id,
          quantity: r.quantity,
          grams: r.grams,
          expiresAt,
        })),
      });

      // ---- 5. Status history + initial payment attempt ----
      await tx.orderStatusHistory.create({
        data: { orderId: created.id, status: "PENDING_PAYMENT", note: "سفارش ثبت شد" },
      });

      const isManualMethod = dto.paymentMethod === "CARD_TO_CARD" || dto.paymentMethod === "SHEBA";
      await tx.paymentAttempt.create({
        data: {
          orderId: created.id,
          method: dto.paymentMethod,
          status: isManualMethod ? "REQUIRES_CONFIRMATION" : "PENDING",
          amount: total,
          idempotencyKey: randomUUID(),
        },
      });

      // ---- 6. Clear the cart that was just converted into an order ----
      await tx.cartItem.deleteMany({ where: { cartId } });

      return created;
    });

    const provider = await this.paymentProviders.getProvider(dto.paymentMethod);
    const initiation = await provider.initiate({ orderId: order.id, amount: total, idempotencyKey: randomUUID() });

    return {
      order,
      paymentInstructions: initiation.instructions,
      redirectUrl: initiation.redirectUrl,
      cardDisplay: initiation.cardDisplay,
    };
  }

  /** Customer's own order history — never another customer's orders. */
  async listForCustomer(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: ORDER_INCLUDE,
    });
  }

  /** Ownership-checked single-order fetch. Guest orders (no customerId) are not retrievable this way — see IMPLEMENTATION_STATUS.md. */
  async getForCustomer(orderId: string, customerId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!order) {
      throw new NotFoundException("سفارش یافت نشد");
    }
    if (order.customerId !== customerId) {
      throw new ForbiddenException("شما اجازه دسترسی به این سفارش را ندارید");
    }
    return order;
  }

  /**
   * Public order tracking — deliberately requires the order number
   * *and* the phone number used for that order, not the order number
   * alone. `AU-XXXXXXX` order numbers (see order-number.util.ts) are a
   * ~36-bit random identifier meant to be short and easy to read/copy,
   * not a secret credential — a lookup keyed on the order number by
   * itself would let anyone who happened to guess or observe one
   * order number see that customer's full name, phone, and shipping
   * address. Requiring the phone too means an attacker needs to
   * correctly guess two independent pieces of information for the
   * same order, not one.
   *
   * Phone comparison is normalized on both sides (see
   * normalizeIranianMobile) because `guestPhone` is stored exactly as
   * the customer typed it at checkout (see `checkout()` above — it is
   * NOT normalized before being persisted), so "09121234567" and
   * "+989121234567" must be treated as the same number here even
   * though they're different stored strings for a guest order.
   * Authenticated-customer orders have no `guestPhone` of their own;
   * their linked Customer.phone (which IS stored normalized — see the
   * Customer model) is used instead.
   *
   * Returns null (not a thrown exception) on any mismatch — order
   * number not found, or found but the phone doesn't match — so the
   * controller can return one generic "not found" message either way,
   * without revealing which of the two failed (that distinction itself
   * would leak whether a given order number exists at all).
   */
  async trackByOrderNumberAndPhone(orderNumber: string, phone: string): Promise<OrderWithRelations | null> {
    const normalizedInput = normalizeIranianMobile(phone);
    if (!normalizedInput) {
      return null;
    }

    const trackingInclude = { ...ORDER_INCLUDE, customer: { select: { phone: true } } } satisfies Prisma.OrderInclude;
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: trackingInclude,
    });
    if (!order) {
      return null;
    }

    const orderPhone = order.customer?.phone ?? order.guestPhone;
    const normalizedOrderPhone = orderPhone ? normalizeIranianMobile(orderPhone) : null;
    if (!normalizedOrderPhone || normalizedOrderPhone !== normalizedInput) {
      return null;
    }

    // `order` here is structurally OrderWithRelations plus an extra
    // `customer` field the caller doesn't need (it was only fetched to
    // perform the phone check above) — the controller only ever
    // forwards this to the same JSON response shape as every other
    // order-view endpoint, so the extra field is dropped by simply not
    // being part of that shared shape's consumers. Asserting the type
    // here (rather than widening OrderWithRelations itself, which every
    // OTHER method in this file also relies on NOT including customer
    // data) keeps this one method's slightly different query shape from
    // leaking into the rest of the file's type contract.
    return order as OrderWithRelations;
  }

  /**
   * Admin-facing order lookup — unlike `getForCustomer`, deliberately
   * does NOT check ownership, since an admin is authorized to view any
   * order. Authorization here is enforced entirely upstream by
   * `AdminSessionGuard` on the controller route, never by this method.
   */
  async getForAdmin(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!order) {
      throw new NotFoundException("سفارش یافت نشد");
    }
    return order;
  }

  /** Paginated admin order listing, most recent first. */
  async listForAdmin(params: { page: number; pageSize: number; status?: OrderStatus }) {
    const { page, pageSize, status } = params;
    const where: Prisma.OrderWhereInput = status ? { status } : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Marks an order PAID and *consumes* its reservations (permanently
   * deducts from on-hand stock rather than merely holding it). This is
   * intentionally NOT wired to a public HTTP endpoint yet — real payment
   * confirmation must come from a trusted source (a gateway webhook, or
   * an authenticated admin action for manual transfers), and admin
   * authentication is out of scope for this cycle. The domain logic is
   * implemented and tested now so wiring the trigger later is a thin
   * layer, not a redesign.
   */
  async markOrderPaid(orderId: string, confirmedByAdminId?: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { ...ORDER_INCLUDE, inventoryReservations: true },
    });
    if (!order) {
      throw new NotFoundException("سفارش یافت نشد");
    }
    if (!isValidOrderStatusTransition(order.status as OrderStatus, "PAID")) {
      throw new BadRequestException(`سفارش در وضعیت ${order.status} قابل تایید پرداخت نیست`);
    }

    return this.prisma.runSerializable(async (tx) => {
      for (const reservation of order.inventoryReservations) {
        if (reservation.status !== "ACTIVE") continue;
        const variant = await tx.variant.findUniqueOrThrow({ where: { id: reservation.variantId } });
        await tx.inventory.update({
          where: { productProducerId: variant.productProducerId },
          data: {
            onHandGrams: { decrement: reservation.grams },
            reservedGrams: { decrement: reservation.grams },
          },
        });
        await tx.inventoryReservation.update({
          where: { id: reservation.id },
          data: { status: "CONSUMED", releasedAt: new Date() },
        });
      }

      await tx.order.update({ where: { id: orderId }, data: { status: "PAID" } });
      await tx.orderStatusHistory.create({
        data: { orderId, status: "PAID", changedByAdminId: confirmedByAdminId, note: "پرداخت تایید شد" },
      });
      const paymentAttempt = await tx.paymentAttempt.findFirst({
        where: { orderId, status: "REQUIRES_CONFIRMATION" },
        orderBy: { createdAt: "desc" },
      });
      if (paymentAttempt) {
        await tx.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: { status: "SUCCEEDED", confirmedByAdminId, confirmedAt: new Date() },
        });
      }

      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
    });
  }

  /**
   * Cancels an order. Releases still-ACTIVE reservations back to
   * available stock (the PENDING_PAYMENT → CANCELLED case). If the order
   * had already reached PAID, its reservations are already CONSUMED (see
   * `markOrderPaid`) rather than ACTIVE — grams were permanently deducted
   * from `onHandGrams`, not merely held — so this also restocks based on
   * the order's own item snapshots in that case, via the same
   * `restockPaidOrderItems` helper `adminSetStatus` uses for CANCELLED/
   * REFUNDED transitions on an already-paid order. Without this, a
   * customer cancelling a just-paid order would silently lose that stock
   * forever (still deducted, never returned, and no reservation left to
   * release since it had already flipped to CONSUMED).
   */
  async cancelOrder(orderId: string, customerId: string): Promise<OrderWithRelations> {
    const order = await this.getForCustomer(orderId, customerId);
    if (!isValidOrderStatusTransition(order.status as OrderStatus, "CANCELLED")) {
      throw new BadRequestException(`سفارش در وضعیت ${order.status} قابل لغو نیست`);
    }
    const wasPaid = order.status !== "PENDING_PAYMENT";

    return this.prisma.runSerializable(async (tx) => {
      if (wasPaid) {
        await this.restockPaidOrderItems(tx, orderId);
      } else {
        const reservations = await tx.inventoryReservation.findMany({ where: { orderId, status: "ACTIVE" } });
        for (const reservation of reservations) {
          const variant = await tx.variant.findUniqueOrThrow({ where: { id: reservation.variantId } });
          await tx.inventory.update({
            where: { productProducerId: variant.productProducerId },
            data: { reservedGrams: { decrement: reservation.grams } },
          });
          await tx.inventoryReservation.update({
            where: { id: reservation.id },
            data: { status: "RELEASED", releasedAt: new Date() },
          });
        }
      }

      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
      await tx.orderStatusHistory.create({
        data: { orderId, status: "CANCELLED", note: "سفارش توسط مشتری لغو شد" },
      });

      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
    });
  }

  /**
   * Restocks `onHandGrams` for every item on an already-PAID order, using
   * the order's own item snapshots (`OrderItem.variantId`/`quantity`) —
   * not `InventoryReservation` rows, which are already `CONSUMED` and not
   * meant to be flipped back (there's no "un-consumed" reservation
   * status; consumption at PAID time is intentionally permanent
   * bookkeeping, see `markOrderPaid`). Grams-per-package come from the
   * variant's current weight option; if a variant was deleted since the
   * order was placed, its historical `weightLabelSnapshot` can't be
   * mapped back to a gram figure reliably, so that line is skipped
   * (logged via the order note) rather than guessed.
   */
  private async restockPaidOrderItems(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<{ skippedVariantIds: string[] }> {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { variantId: true, quantity: true },
    });

    const skippedVariantIds: string[] = [];
    for (const item of items) {
      const variant = await tx.variant.findUnique({
        where: { id: item.variantId },
        include: { weightOption: true },
      });
      if (!variant) {
        skippedVariantIds.push(item.variantId);
        continue;
      }
      const grams = variant.weightOption.grams * item.quantity;
      await tx.inventory.update({
        where: { productProducerId: variant.productProducerId },
        data: { onHandGrams: { increment: grams } },
      });
    }
    return { skippedVariantIds };
  }

  /**
   * Admin-driven order status transitions beyond "mark paid" — advancing
   * through fulfillment (PROCESSING → SHIPPED → DELIVERED) or cancelling/
   * refunding a paid order. Fulfillment-only transitions (PROCESSING,
   * SHIPPED, DELIVERED) touch no inventory — stock was already
   * permanently deducted at PAID time and stays deducted while the order
   * is genuinely being fulfilled. CANCELLED/REFUNDED from PAID or later
   * restock via `restockPaidOrderItems`, since the goods are (or should
   * be) coming back. See `order-status.util.ts` for the full transition
   * graph this validates against — this method is intentionally generic
   * over every entry in that graph rather than one method per status, so
   * a future status addition to the graph doesn't also require a new
   * controller route here.
   */
  async adminSetStatus(
    orderId: string,
    toStatus: Exclude<OrderStatus, "PENDING_PAYMENT" | "PAID">,
    adminId: string,
    note?: string,
  ): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException("سفارش یافت نشد");
    }
    const fromStatus = order.status as OrderStatus;
    if (!isValidOrderStatusTransition(fromStatus, toStatus)) {
      throw new BadRequestException(`تغییر وضعیت از ${fromStatus} به ${toStatus} مجاز نیست`);
    }

    return this.prisma.runSerializable(async (tx) => {
      const isRestockingTransition = toStatus === "CANCELLED" || toStatus === "REFUNDED";
      if (isRestockingTransition) {
        await this.restockPaidOrderItems(tx, orderId);
      }

      await tx.order.update({ where: { id: orderId }, data: { status: toStatus } });
      await tx.orderStatusHistory.create({
        data: { orderId, status: toStatus, changedByAdminId: adminId, note },
      });

      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
    });
  }

  /**
   * Attempts to verify payment for an order via its payment provider.
   * For CARD_TO_CARD/SHEBA this always reports "not applicable" (those
   * methods are confirmed manually — see `markOrderPaid`, not verified
   * through a provider). For ONLINE, this calls through to
   * `UnconfiguredOnlinePaymentProvider.verify()`, which throws a clear,
   * honest error rather than a real gateway check, since no gateway is
   * configured yet (see IMPLEMENTATION_STATUS.md). This endpoint exists
   * now specifically so the abstraction — and its current limitation —
   * is a real, callable, documented part of the API rather than only a
   * paper design.
   */
  async verifyPayment(orderId: string, customerId: string): Promise<{ success: boolean; message: string }> {
    const order = await this.getForCustomer(orderId, customerId);
    const latestAttempt = order.paymentAttempts[0];
    if (!latestAttempt) {
      throw new NotFoundException("تلاش پرداختی برای این سفارش ثبت نشده است");
    }

    if (latestAttempt.method === "CARD_TO_CARD" || latestAttempt.method === "SHEBA") {
      return {
        success: false,
        message: "این روش پرداخت به تایید دستی نیاز دارد و از این طریق قابل بررسی نیست",
      };
    }

    const provider = await this.paymentProviders.getProvider(latestAttempt.method as "ONLINE");
    try {
      const result = await provider.verify(latestAttempt.providerRef ?? "");
      return { success: result.success, message: result.message ?? "" };
    } catch (err) {
      // UnconfiguredOnlinePaymentProvider throws a plain Error with a
      // specific, honest, customer-facing message ("gateway not
      // connected yet") — without this catch, the global exception
      // filter would swallow that message behind a generic "Internal
      // server error" (correctly, for genuinely unexpected errors, but
      // this one is an expected, documented limitation, not a bug).
      const message = err instanceof Error ? err.message : "بررسی پرداخت ممکن نشد";
      throw new BadRequestException(message);
    }
  }

  // ---- internal helpers ---------------------------------------------

  /**
   * Resolves the shipping address for this checkout from either a saved
   * `addressId` (ownership-checked — a customer can never ship to
   * another customer's saved address by guessing an id) or an inline
   * `shippingAddress`. Exactly one must be usable; guests can never use
   * `addressId` since they have no persisted addresses.
   */
  private async resolveShippingAddress(dto: CheckoutDto, customerId: string | null): Promise<AddressFieldsDto> {
    if (dto.addressId) {
      if (!customerId) {
        throw new BadRequestException("آدرس ذخیره‌شده فقط برای مشتریان وارد شده قابل استفاده است");
      }
      const saved = await this.addresses.getOwned(customerId, dto.addressId);
      return {
        recipientName: saved.recipientName,
        phone: saved.phone,
        province: saved.province,
        city: saved.city,
        addressLine: saved.addressLine,
        postalCode: saved.postalCode,
      };
    }

    if (dto.shippingAddress) {
      return dto.shippingAddress;
    }

    throw new BadRequestException("آدرس ارسال الزامی است");
  }
}
