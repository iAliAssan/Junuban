import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { availablePackages } from "../catalog/inventory.util";
import { clampQuantity, normalizePackagingOptionId } from "./cart-identity.util";
import type { Cart, Prisma } from "@prisma/client";
import type { AddCartItemDto } from "./dto/add-cart-item.dto";

export interface CartItemView {
  id: string;
  variantId: string;
  productSlug: string;
  productName: string;
  producerName: string;
  weightLabel: string;
  grams: number;
  image: { url: string; altText: string } | null;
  packagingOptionId: string | null;
  packagingName: string | null;
  packagingPriceDelta: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  availablePackages: number;
  /** True when the cart quantity now exceeds live availability (stock moved since it was added) — surfaced, never hidden. */
  hasAvailabilityIssue: boolean;
}

export interface CartView {
  id: string;
  items: CartItemView[];
  itemCount: number;
  subtotal: number;
  /** Equal to subtotal for now — shipping/discounts are a checkout-cycle concern, not introduced here. */
  total: number;
}

const CART_ITEM_INCLUDE = {
  variant: {
    include: {
      weightOption: true,
      productProducer: {
        include: {
          producer: true,
          inventory: true,
          product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
        },
      },
    },
  },
  packagingOption: true,
} satisfies Prisma.CartItemInclude;

type CartItemWithRelations = Prisma.CartItemGetPayload<{ include: typeof CART_ITEM_INCLUDE }>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateCustomerCart(customerId: string): Promise<Cart> {
    const existing = await this.prisma.cart.findFirst({ where: { customerId } });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { customerId } });
  }

  async getOrCreateGuestCart(guestToken: string): Promise<Cart> {
    const existing = await this.prisma.cart.findUnique({ where: { guestToken } });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { guestToken } });
  }

  async getCart(cartId: string): Promise<CartView> {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
      orderBy: { createdAt: "asc" },
      include: CART_ITEM_INCLUDE,
    });
    return this.shapeCart(cartId, items);
  }

  async addItem(cartId: string, dto: AddCartItemDto): Promise<CartView> {
    const packagingOptionId = normalizePackagingOptionId(dto.packagingOptionId);
    const quantity = clampQuantity(dto.quantity ?? 1);

    const variant = await this.loadVariantForValidation(dto.variantId);
    if (!variant) {
      throw new BadRequestException("محصول انتخابی معتبر نیست");
    }
    if (packagingOptionId) {
      await this.assertPackagingOptionActive(packagingOptionId);
    }

    const existingLine = await this.findCartLine(this.prisma, cartId, dto.variantId, packagingOptionId);

    const requestedTotalQuantity = clampQuantity((existingLine?.quantity ?? 0) + quantity);
    this.assertAvailability(variant, requestedTotalQuantity);

    await this.upsertCartLine(
      this.prisma,
      cartId,
      dto.variantId,
      packagingOptionId,
      requestedTotalQuantity,
      existingLine?.id,
    );

    return this.getCart(cartId);
  }

  async updateItemQuantity(cartId: string, itemId: string, quantity: number): Promise<CartView> {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
    if (!item) {
      throw new NotFoundException("کالای مورد نظر در سبد خرید یافت نشد");
    }

    const variant = await this.loadVariantForValidation(item.variantId);
    if (!variant) {
      throw new BadRequestException("محصول انتخابی معتبر نیست");
    }

    const clamped = clampQuantity(quantity);
    this.assertAvailability(variant, clamped);

    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity: clamped } });
    return this.getCart(cartId);
  }

  async removeItem(cartId: string, itemId: string): Promise<CartView> {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
    if (!item) {
      throw new NotFoundException("کالای مورد نظر در سبد خرید یافت نشد");
    }
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(cartId);
  }

  async clearCart(cartId: string): Promise<CartView> {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
    return this.getCart(cartId);
  }

  /**
   * Called right after a successful OTP verification (see
   * AuthController.verifyOtp). Merges any guest-cart lines into the
   * customer's own cart, matching lines by (variantId, packagingOptionId)
   * exactly — a packaging difference never merges. Quantities are summed
   * and re-clamped to 1–99. The guest cart row itself is deleted
   * afterwards so a stale guest cookie can never resurrect it.
   */
  async mergeGuestCartOnLogin(guestToken: string, customerId: string): Promise<void> {
    const guestCart = await this.prisma.cart.findUnique({
      where: { guestToken },
      include: { items: true },
    });
    if (!guestCart || guestCart.items.length === 0) {
      if (guestCart) await this.prisma.cart.delete({ where: { id: guestCart.id } });
      return;
    }

    const customerCart = await this.getOrCreateCustomerCart(customerId);

    await this.prisma.$transaction(async (tx) => {
      for (const guestItem of guestCart.items) {
        const existing = await this.findCartLine(
          tx,
          customerCart.id,
          guestItem.variantId,
          guestItem.packagingOptionId,
        );

        const mergedQuantity = clampQuantity((existing?.quantity ?? 0) + guestItem.quantity);

        await this.upsertCartLine(
          tx,
          customerCart.id,
          guestItem.variantId,
          guestItem.packagingOptionId,
          mergedQuantity,
          existing?.id,
        );
      }

      // Deleting the cart cascades to its (now-merged) items.
      await tx.cart.delete({ where: { id: guestCart.id } });
    });
  }

  // ---- internal helpers ---------------------------------------------

  /**
   * Looks up a cart line by (cartId, variantId, packagingOptionId).
   *
   * Cannot use `findUnique` with the `cartId_variantId_packagingOptionId`
   * compound key here: Prisma's generated compound-unique input requires
   * every field to be its non-null base type, even though
   * `packagingOptionId` is genuinely optional on the model (`String?`).
   * This isn't a type-hole to paper over — it reflects a real SQL
   * property this schema deliberately relies on (see the `@@unique`
   * comment on `CartItem`): Postgres treats every `NULL` as distinct
   * from every other `NULL`, so "the row with this variant and no
   * packaging" isn't expressible as an equality lookup against a
   * literal `null` inside a compound key the way Prisma's typed API
   * models it. `findFirst` with an explicit `packagingOptionId: null`
   * filter is the correct, fully-typed way to express that lookup, and
   * is just as correct here since (cartId, variantId, packagingOptionId)
   * is still enforced unique at the database level — at most one row
   * can ever match.
   */
  private async findCartLine(
    client: Pick<Prisma.TransactionClient, "cartItem"> | PrismaService,
    cartId: string,
    variantId: string,
    packagingOptionId: string | null,
  ) {
    if (packagingOptionId === null) {
      return client.cartItem.findFirst({
        where: { cartId, variantId, packagingOptionId: null },
      });
    }
    return client.cartItem.findUnique({
      where: { cartId_variantId_packagingOptionId: { cartId, variantId, packagingOptionId } },
    });
  }

  /**
   * Creates or updates a cart line — see {@link findCartLine} for why the
   * null-packaging case can't use `upsert` directly. `existingId`, when
   * provided, is the id of a line the caller already looked up (e.g. via
   * {@link findCartLine} for the availability check) — passing it avoids
   * a second redundant lookup for the null-packaging path. If omitted,
   * this method looks it up itself.
   */
  private async upsertCartLine(
    client: Pick<Prisma.TransactionClient, "cartItem"> | PrismaService,
    cartId: string,
    variantId: string,
    packagingOptionId: string | null,
    quantity: number,
    existingId?: string,
  ): Promise<void> {
    if (packagingOptionId === null) {
      const id =
        existingId ??
        (
          await client.cartItem.findFirst({
            where: { cartId, variantId, packagingOptionId: null },
            select: { id: true },
          })
        )?.id;

      if (id) {
        await client.cartItem.update({ where: { id }, data: { quantity } });
      } else {
        await client.cartItem.create({ data: { cartId, variantId, packagingOptionId: null, quantity } });
      }
      return;
    }

    await client.cartItem.upsert({
      where: { cartId_variantId_packagingOptionId: { cartId, variantId, packagingOptionId } },
      update: { quantity },
      create: { cartId, variantId, packagingOptionId, quantity },
    });
  }

  private async loadVariantForValidation(variantId: string) {
    return this.prisma.variant.findFirst({
      where: { id: variantId, isActive: true },
      include: {
        weightOption: true,
        productProducer: { include: { inventory: true, product: true } },
      },
    });
  }

  private async assertPackagingOptionActive(packagingOptionId: string): Promise<void> {
    const packaging = await this.prisma.packagingOption.findFirst({
      where: { id: packagingOptionId, isActive: true },
    });
    if (!packaging) {
      throw new BadRequestException("گزینه بسته‌بندی انتخابی معتبر نیست");
    }
  }

  private assertAvailability(
    variant: NonNullable<Awaited<ReturnType<CartService["loadVariantForValidation"]>>>,
    requestedQuantity: number,
  ): void {
    const available = availablePackages(
      variant.productProducer.inventory?.onHandGrams ?? 0,
      variant.productProducer.inventory?.reservedGrams ?? 0,
      variant.weightOption.grams,
    );
    if (requestedQuantity > available) {
      throw new BadRequestException(
        available === 0
          ? "این کالا در حال حاضر موجود نیست"
          : `تنها ${available} بسته از این کالا موجود است`,
      );
    }
  }

  private shapeCart(cartId: string, items: CartItemWithRelations[]): CartView {
    const shapedItems: CartItemView[] = items.map((item) => {
      const variant = item.variant;
      const pp = variant.productProducer;
      const available = availablePackages(
        pp.inventory?.onHandGrams ?? 0,
        pp.inventory?.reservedGrams ?? 0,
        variant.weightOption.grams,
      );
      const packagingPriceDelta = item.packagingOption?.priceDelta ?? 0;
      const unitPrice = variant.price;
      const lineTotal = (unitPrice + packagingPriceDelta) * item.quantity;

      return {
        id: item.id,
        variantId: variant.id,
        productSlug: pp.product.slug,
        productName: pp.product.name,
        producerName: pp.producer.name,
        weightLabel: variant.weightOption.label,
        grams: variant.weightOption.grams,
        image: pp.product.images[0]
          ? { url: pp.product.images[0].url, altText: pp.product.images[0].altText }
          : null,
        packagingOptionId: item.packagingOptionId,
        packagingName: item.packagingOption?.name ?? null,
        packagingPriceDelta,
        unitPrice,
        quantity: item.quantity,
        lineTotal,
        availablePackages: available,
        hasAvailabilityIssue: item.quantity > available,
      };
    });

    const subtotal = shapedItems.reduce((sum, i) => sum + i.lineTotal, 0);

    return {
      id: cartId,
      items: shapedItems,
      itemCount: shapedItems.reduce((sum, i) => sum + i.quantity, 0),
      subtotal,
      total: subtotal,
    };
  }
}
