import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CartService } from "./cart.service";
import type { PrismaService } from "../prisma/prisma.service";

function makeVariant(opts: {
  id: string;
  price: number;
  grams: number;
  onHandGrams: number;
  reservedGrams?: number;
  isActive?: boolean;
}) {
  return {
    id: opts.id,
    price: opts.price,
    isActive: opts.isActive ?? true,
    weightOption: { grams: opts.grams, label: `${opts.grams} گرم` },
    productProducer: {
      inventory: { onHandGrams: opts.onHandGrams, reservedGrams: opts.reservedGrams ?? 0 },
      product: { slug: "mozafati-date", name: "خرمای مضافتی", images: [] },
      producer: { name: "تعاونی خرمای میناب" },
    },
  };
}

function makeCartItemRow(opts: {
  id: string;
  variantId: string;
  packagingOptionId: string | null;
  quantity: number;
  variant: ReturnType<typeof makeVariant>;
  packagingOption?: { id: string; name: string; priceDelta: number } | null;
}) {
  return {
    id: opts.id,
    variantId: opts.variantId,
    packagingOptionId: opts.packagingOptionId,
    quantity: opts.quantity,
    variant: opts.variant,
    packagingOption: opts.packagingOption ?? null,
  };
}

describe("CartService", () => {
  function makeService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      cart: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      cartItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      variant: { findFirst: jest.fn() },
      packagingOption: { findFirst: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaTxProxy)),
      ...overrides,
    };
    // The transaction callback receives `tx`, which in our tests just reuses
    // the same mocked delegate objects (sufficient for these unit tests —
    // we're testing CartService's logic, not Prisma's transaction machinery).
    const prismaTxProxy = prisma;
    const service = new CartService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  describe("addItem", () => {
    it("rejects an inactive/nonexistent variant", async () => {
      const { service, prisma } = makeService();
      (prisma.variant.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addItem("cart-1", { variantId: "bad-variant", quantity: 1 } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an inactive/nonexistent packaging option", async () => {
      const { service, prisma } = makeService();
      (prisma.variant.findFirst as jest.Mock).mockResolvedValue(
        makeVariant({ id: "v1", price: 145000, grams: 250, onHandGrams: 10000 }),
      );
      (prisma.packagingOption.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addItem("cart-1", { variantId: "v1", packagingOptionId: "bad-packaging", quantity: 1 } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects adding more than the currently available packages", async () => {
      const { service, prisma } = makeService();
      // 500g on hand / 250g per package = 2 available packages.
      (prisma.variant.findFirst as jest.Mock).mockResolvedValue(
        makeVariant({ id: "v1", price: 145000, grams: 250, onHandGrams: 500 }),
      );

      await expect(
        service.addItem("cart-1", { variantId: "v1", quantity: 3 } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("clamps quantity to 99 even if a larger value is requested", async () => {
      const { service, prisma } = makeService();
      (prisma.variant.findFirst as jest.Mock).mockResolvedValue(
        makeVariant({ id: "v1", price: 145000, grams: 250, onHandGrams: 250_000 }), // effectively unlimited
      );
      (prisma.cartItem.findMany as jest.Mock).mockResolvedValue([]);

      await service.addItem("cart-1", { variantId: "v1", quantity: 500 } as never);

      const createArgs = (prisma.cartItem.upsert as jest.Mock).mock.calls[0][0];
      expect(createArgs.create.quantity).toBe(99);
      expect(createArgs.update.quantity).toBe(99);
    });

    it("merges into an existing identical line (same variant + same packaging) by summing quantity", async () => {
      const { service, prisma } = makeService();
      (prisma.variant.findFirst as jest.Mock).mockResolvedValue(
        makeVariant({ id: "v1", price: 145000, grams: 250, onHandGrams: 10000 }),
      );
      (prisma.cartItem.findUnique as jest.Mock).mockResolvedValue({ id: "line-1", quantity: 2 });

      await service.addItem("cart-1", { variantId: "v1", quantity: 3 } as never);

      const upsertArgs = (prisma.cartItem.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertArgs.update.quantity).toBe(5); // 2 existing + 3 new
    });

    it("treats a different packaging choice as a separate line, never merging with a differently-packaged line", async () => {
      const { service, prisma } = makeService();
      (prisma.variant.findFirst as jest.Mock).mockResolvedValue(
        makeVariant({ id: "v1", price: 145000, grams: 250, onHandGrams: 10000 }),
      );
      (prisma.packagingOption.findFirst as jest.Mock).mockResolvedValue({ id: "pkg-gift", priceDelta: 45000 });
      // No existing line for THIS specific (variant, packaging) combination.
      (prisma.cartItem.findUnique as jest.Mock).mockResolvedValue(null);

      await service.addItem("cart-1", { variantId: "v1", packagingOptionId: "pkg-gift", quantity: 1 } as never);

      const upsertArgs = (prisma.cartItem.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertArgs.where.cartId_variantId_packagingOptionId.packagingOptionId).toBe("pkg-gift");
      expect(upsertArgs.create.quantity).toBe(1); // not merged with any plain-packaging line
    });
  });

  describe("updateItemQuantity", () => {
    it("throws NotFoundException when the item doesn't belong to this cart", async () => {
      const { service, prisma } = makeService();
      (prisma.cartItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.updateItemQuantity("cart-1", "item-x", 2)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("re-validates availability on update, not just on add", async () => {
      const { service, prisma } = makeService();
      (prisma.cartItem.findFirst as jest.Mock).mockResolvedValue({ id: "item-1", variantId: "v1", quantity: 1 });
      (prisma.variant.findFirst as jest.Mock).mockResolvedValue(
        makeVariant({ id: "v1", price: 145000, grams: 250, onHandGrams: 500 }), // only 2 packages available
      );

      await expect(service.updateItemQuantity("cart-1", "item-1", 5)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("removeItem / clearCart", () => {
    it("throws NotFoundException when removing an item not in this cart", async () => {
      const { service, prisma } = makeService();
      (prisma.cartItem.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.removeItem("cart-1", "item-x")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("clearCart deletes all items for the cart", async () => {
      const { service, prisma } = makeService();
      await service.clearCart("cart-1");
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: "cart-1" } });
    });
  });

  describe("getCart — shaping", () => {
    it("computes line totals from (unitPrice + packagingPriceDelta) * quantity, never a per-kg formula", async () => {
      const { service, prisma } = makeService();
      const variant = makeVariant({ id: "v1", price: 260000, grams: 500, onHandGrams: 10000 });
      (prisma.cartItem.findMany as jest.Mock).mockResolvedValue([
        makeCartItemRow({
          id: "item-1",
          variantId: "v1",
          packagingOptionId: "pkg-gift",
          quantity: 2,
          variant,
          packagingOption: { id: "pkg-gift", name: "جعبه هدیه", priceDelta: 45000 },
        }),
      ]);

      const cart = await service.getCart("cart-1");

      // (260000 + 45000) * 2 = 610000
      expect(cart.items[0].lineTotal).toBe(610000);
      expect(cart.subtotal).toBe(610000);
      expect(cart.total).toBe(610000);
    });

    it("flags hasAvailabilityIssue when cart quantity now exceeds live stock", async () => {
      const { service, prisma } = makeService();
      const variant = makeVariant({ id: "v1", price: 145000, grams: 250, onHandGrams: 250 }); // only 1 available now
      (prisma.cartItem.findMany as jest.Mock).mockResolvedValue([
        makeCartItemRow({ id: "item-1", variantId: "v1", packagingOptionId: null, quantity: 3, variant }),
      ]);

      const cart = await service.getCart("cart-1");

      expect(cart.items[0].availablePackages).toBe(1);
      expect(cart.items[0].hasAvailabilityIssue).toBe(true);
    });

    it("sums itemCount across all lines by quantity, not by line count", async () => {
      const { service, prisma } = makeService();
      const variant = makeVariant({ id: "v1", price: 145000, grams: 250, onHandGrams: 10000 });
      (prisma.cartItem.findMany as jest.Mock).mockResolvedValue([
        makeCartItemRow({ id: "item-1", variantId: "v1", packagingOptionId: null, quantity: 2, variant }),
        makeCartItemRow({ id: "item-2", variantId: "v1", packagingOptionId: "pkg-gift", quantity: 3, variant }),
      ]);

      const cart = await service.getCart("cart-1");
      expect(cart.itemCount).toBe(5);
    });
  });

  describe("mergeGuestCartOnLogin", () => {
    it("deletes an empty or nonexistent guest cart without creating a customer cart", async () => {
      const { service, prisma } = makeService();
      (prisma.cart.findUnique as jest.Mock).mockResolvedValue(null);

      await service.mergeGuestCartOnLogin("guest-token", "customer-1");

      expect(prisma.cart.create).not.toHaveBeenCalled();
    });

    it("sums quantities when a merged line already exists in the customer cart", async () => {
      const { service, prisma } = makeService();
      (prisma.cart.findUnique as jest.Mock).mockResolvedValue({
        id: "guest-cart-1",
        items: [{ variantId: "v1", packagingOptionId: null, quantity: 2 }],
      });
      (prisma.cart.findFirst as jest.Mock).mockResolvedValue({ id: "customer-cart-1", customerId: "customer-1" });
      (prisma.cartItem.findUnique as jest.Mock).mockResolvedValue({ quantity: 4 }); // existing line in customer cart

      await service.mergeGuestCartOnLogin("guest-token", "customer-1");

      const upsertArgs = (prisma.cartItem.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertArgs.update.quantity).toBe(6); // 4 existing + 2 from guest cart
      expect(prisma.cart.delete).toHaveBeenCalledWith({ where: { id: "guest-cart-1" } });
    });

    it("never merges a guest line into a differently-packaged customer line", async () => {
      const { service, prisma } = makeService();
      (prisma.cart.findUnique as jest.Mock).mockResolvedValue({
        id: "guest-cart-1",
        items: [{ variantId: "v1", packagingOptionId: "pkg-gift", quantity: 1 }],
      });
      (prisma.cart.findFirst as jest.Mock).mockResolvedValue({ id: "customer-cart-1", customerId: "customer-1" });
      (prisma.cartItem.findUnique as jest.Mock).mockResolvedValue(null); // no matching pkg-gift line yet

      await service.mergeGuestCartOnLogin("guest-token", "customer-1");

      const findUniqueArgs = (prisma.cartItem.findUnique as jest.Mock).mock.calls[0][0];
      expect(findUniqueArgs.where.cartId_variantId_packagingOptionId.packagingOptionId).toBe("pkg-gift");
    });
  });
});
