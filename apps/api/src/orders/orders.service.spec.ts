import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { CartService, CartView } from "../cart/cart.service";
import type { ConfigService } from "@nestjs/config";
import type { PaymentProviderFactory } from "./payment/payment-provider.factory";

function makeCartView(overrides: Partial<CartView> = {}): CartView {
  return {
    id: "cart-1",
    items: [
      {
        id: "cart-item-1",
        variantId: "variant-1",
        productSlug: "mozafati-date",
        productName: "خرمای مضافتی",
        producerName: "تعاونی خرمای میناب",
        weightLabel: "۵۰۰ گرم",
        grams: 500,
        image: null,
        packagingOptionId: null,
        packagingName: null,
        packagingPriceDelta: 0,
        unitPrice: 260000,
        quantity: 2,
        lineTotal: 520000,
        availablePackages: 10,
        hasAvailabilityIssue: false,
      },
    ],
    itemCount: 2,
    subtotal: 520000,
    total: 520000,
    ...overrides,
  };
}

const VALID_CHECKOUT_DTO = {
  shippingAddress: {
    recipientName: "علی محمدی",
    phone: "09121234567",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزادی، پلاک ۱",
    postalCode: "1234567890",
  },
  paymentMethod: "CARD_TO_CARD" as const,
  idempotencyKey: "11111111-1111-1111-1111-111111111111",
};

describe("OrdersService", () => {
  function makeService(opts: { cartOverrides?: Partial<CartView>; prismaOverrides?: Record<string, unknown> } = {}) {
    const txMock = {
      variant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "variant-1",
          isActive: true,
          productProducerId: "pp-1",
          weightOption: { grams: 500 },
          productProducer: { inventory: { onHandGrams: 10000, reservedGrams: 0 } },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "variant-1", productProducerId: "pp-1" }),
      },
      inventory: { update: jest.fn() },
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "order-1", orderNumber: "JB-20260912-ABC123" }),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "order-1", status: "PAID" }),
      },
      inventoryReservation: {
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      orderStatusHistory: { create: jest.fn() },
      paymentAttempt: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      cartItem: { deleteMany: jest.fn() },
    };

    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
      },
      runSerializable: jest.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
      ...opts.prismaOverrides,
    };

    const cart = {
      getCart: jest.fn().mockResolvedValue(makeCartView(opts.cartOverrides)),
    };

    const config = {
      get: jest.fn((key: string) => {
        if (key === "shipping") return { flatRateToman: 350000, freeThresholdToman: 2000000, freeEnabled: true };
        if (key === "inventory") return { reservationTtlMinutes: 15 };
        if (key === "payment") return { cardToCard: {}, sheba: {} };
        return {};
      }),
    };

    const paymentProviders = {
      getProvider: jest.fn().mockReturnValue({
        initiate: jest.fn().mockResolvedValue({ instructions: "به این شماره کارت واریز کنید" }),
        verify: jest.fn(),
      }),
    };

    const service = new OrdersService(
      prisma as unknown as PrismaService,
      cart as unknown as CartService,
      config as unknown as ConfigService<never, true>,
      paymentProviders as unknown as PaymentProviderFactory,
    );

    return { service, prisma, cart, config, paymentProviders, txMock };
  }

  describe("checkout — validation", () => {
    it("rejects an empty cart", async () => {
      const { service } = makeService({ cartOverrides: { items: [], subtotal: 0, total: 0, itemCount: 0 } });
      await expect(service.checkout("cart-1", VALID_CHECKOUT_DTO, "customer-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("rejects checkout when a cart line has an availability issue", async () => {
      const { service } = makeService({
        cartOverrides: {
          items: [
            {
              id: "i1",
              variantId: "v1",
              productSlug: "x",
              productName: "کالای کمیاب",
              producerName: "p",
              weightLabel: "۵۰۰ گرم",
              grams: 500,
              image: null,
              packagingOptionId: null,
              packagingName: null,
              packagingPriceDelta: 0,
              unitPrice: 1000,
              quantity: 5,
              lineTotal: 5000,
              availablePackages: 1,
              hasAvailabilityIssue: true,
            },
          ],
        },
      });
      await expect(service.checkout("cart-1", VALID_CHECKOUT_DTO, "customer-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("requires a guest phone number for guest (unauthenticated) checkout", async () => {
      const { service } = makeService();
      const dtoWithoutGuestPhone = { ...VALID_CHECKOUT_DTO };
      await expect(service.checkout("cart-1", dtoWithoutGuestPhone, null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("allows guest checkout when guestPhone is supplied", async () => {
      const { service } = makeService();
      const dto = { ...VALID_CHECKOUT_DTO, guestPhone: "09121234567" };
      await expect(service.checkout("cart-1", dto, null)).resolves.toBeDefined();
    });

    it("returns the existing order instead of creating a duplicate for a repeated idempotency key", async () => {
      const { service, prisma, txMock } = makeService();
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: "order-existing", orderNumber: "JB-X" });

      const result = await service.checkout("cart-1", VALID_CHECKOUT_DTO, "customer-1");

      expect(result.order).toEqual({ id: "order-existing", orderNumber: "JB-X" });
      expect(txMock.order.create).not.toHaveBeenCalled();
    });
  });

  describe("checkout — inventory reservation", () => {
    it("rejects when live availability (re-checked in-transaction) is insufficient", async () => {
      const { service, txMock } = makeService();
      (txMock.variant.findFirst as jest.Mock).mockResolvedValue({
        id: "variant-1",
        isActive: true,
        productProducerId: "pp-1",
        weightOption: { grams: 500 },
        productProducer: { inventory: { onHandGrams: 500, reservedGrams: 0 } },
      });

      await expect(service.checkout("cart-1", VALID_CHECKOUT_DTO, "customer-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(txMock.order.create).not.toHaveBeenCalled();
    });

    it("rejects when the variant is no longer active", async () => {
      const { service, txMock } = makeService();
      (txMock.variant.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.checkout("cart-1", VALID_CHECKOUT_DTO, "customer-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("increments Inventory.reservedGrams by weight × quantity, not a per-kg formula", async () => {
      const { service, txMock } = makeService();
      await service.checkout("cart-1", VALID_CHECKOUT_DTO, "customer-1");

      expect(txMock.inventory.update).toHaveBeenCalledWith({
        where: { productProducerId: "pp-1" },
        data: { reservedGrams: { increment: 1000 } },
      });
    });

    it("creates order items with the exact price snapshot from the cart, never re-derived", async () => {
      const { service, txMock } = makeService();
      await service.checkout("cart-1", VALID_CHECKOUT_DTO, "customer-1");

      const createArgs = (txMock.order.create as jest.Mock).mock.calls[0][0];
      expect(createArgs.data.items.create[0]).toMatchObject({
        unitPriceSnapshot: 260000,
        quantity: 2,
        lineTotal: 520000,
        productNameSnapshot: "خرمای مضافتی",
      });
    });

    it("clears the cart after successfully creating the order", async () => {
      const { service, txMock } = makeService();
      await service.checkout("cart-1", VALID_CHECKOUT_DTO, "customer-1");
      expect(txMock.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: "cart-1" } });
    });

    it("creates the initial payment attempt as REQUIRES_CONFIRMATION for manual methods (card-to-card/Sheba)", async () => {
      const { service, txMock } = makeService();
      await service.checkout("cart-1", VALID_CHECKOUT_DTO, "customer-1");

      const paymentArgs = (txMock.paymentAttempt.create as jest.Mock).mock.calls[0][0];
      expect(paymentArgs.data.status).toBe("REQUIRES_CONFIRMATION");
      expect(paymentArgs.data.method).toBe("CARD_TO_CARD");
    });
  });

  describe("getForCustomer — ownership", () => {
    it("throws NotFoundException for a missing order", async () => {
      const { service, prisma } = makeService();
      (prisma.order as unknown as { findUnique: jest.Mock }).findUnique = jest.fn().mockResolvedValue(null);
      await expect(service.getForCustomer("missing-order", "customer-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ForbiddenException when the order belongs to a different customer", async () => {
      const { service, prisma } = makeService();
      (prisma.order as unknown as { findUnique: jest.Mock }).findUnique = jest
        .fn()
        .mockResolvedValue({ id: "order-1", customerId: "someone-else" });
      await expect(service.getForCustomer("order-1", "customer-1")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("returns the order when the requesting customer is the owner", async () => {
      const { service, prisma } = makeService();
      (prisma.order as unknown as { findUnique: jest.Mock }).findUnique = jest
        .fn()
        .mockResolvedValue({ id: "order-1", customerId: "customer-1" });
      await expect(service.getForCustomer("order-1", "customer-1")).resolves.toMatchObject({ id: "order-1" });
    });
  });

  describe("markOrderPaid", () => {
    it("rejects an invalid status transition (e.g. already CANCELLED)", async () => {
      const { service, prisma } = makeService();
      (prisma.order as unknown as { findUnique: jest.Mock }).findUnique = jest.fn().mockResolvedValue({
        id: "order-1",
        status: "CANCELLED",
        inventoryReservations: [],
      });
      await expect(service.markOrderPaid("order-1")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("consumes active reservations by decrementing both onHandGrams and reservedGrams", async () => {
      const { service, prisma, txMock } = makeService();
      (prisma.order as unknown as { findUnique: jest.Mock }).findUnique = jest.fn().mockResolvedValue({
        id: "order-1",
        status: "PENDING_PAYMENT",
        inventoryReservations: [{ id: "res-1", variantId: "variant-1", status: "ACTIVE", grams: 1000 }],
      });

      await service.markOrderPaid("order-1", "admin-1");

      expect(txMock.inventory.update).toHaveBeenCalledWith({
        where: { productProducerId: "pp-1" },
        data: { onHandGrams: { decrement: 1000 }, reservedGrams: { decrement: 1000 } },
      });
      expect(txMock.inventoryReservation.update).toHaveBeenCalledWith({
        where: { id: "res-1" },
        data: { status: "CONSUMED", releasedAt: expect.any(Date) },
      });
      expect(txMock.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "PAID" } });
    });

    it("skips reservations that are already released/expired rather than double-consuming them", async () => {
      const { service, prisma, txMock } = makeService();
      (prisma.order as unknown as { findUnique: jest.Mock }).findUnique = jest.fn().mockResolvedValue({
        id: "order-1",
        status: "PENDING_PAYMENT",
        inventoryReservations: [{ id: "res-1", variantId: "variant-1", status: "EXPIRED", grams: 1000 }],
      });

      await service.markOrderPaid("order-1");
      expect(txMock.inventory.update).not.toHaveBeenCalled();
    });
  });

  describe("cancelOrder", () => {
    it("releases active reservations back to available stock", async () => {
      const { service, prisma, txMock } = makeService();
      (prisma.order as unknown as { findUnique: jest.Mock }).findUnique = jest
        .fn()
        .mockResolvedValue({ id: "order-1", customerId: "customer-1", status: "PENDING_PAYMENT" });
      (txMock.inventoryReservation.findMany as jest.Mock).mockResolvedValue([
        { id: "res-1", variantId: "variant-1", grams: 1000 },
      ]);

      await service.cancelOrder("order-1", "customer-1");

      expect(txMock.inventory.update).toHaveBeenCalledWith({
        where: { productProducerId: "pp-1" },
        data: { reservedGrams: { decrement: 1000 } },
      });
      expect(txMock.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "CANCELLED" } });
    });

    it("rejects cancelling an order that's already shipped", async () => {
      const { service, prisma } = makeService();
      (prisma.order as unknown as { findUnique: jest.Mock }).findUnique = jest
        .fn()
        .mockResolvedValue({ id: "order-1", customerId: "customer-1", status: "SHIPPED" });
      await expect(service.cancelOrder("order-1", "customer-1")).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
