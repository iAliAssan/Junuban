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

    const existingLine = await this.prisma.cartItem.findUnique({
      where: {
        cartId_variantId_packagingOptionId: { cartId, variantId: dto.variantId, packagingOptionId },
      },
    });

    const requestedTotalQuantity = clampQuantity((existingLine?.quantity ?? 0) + quantity);
    this.assertAvailability(variant, requestedTotalQuantity);

    await this.prisma.cartItem.upsert({
      where: {
        cartId_variantId_packagingOptionId: { cartId, variantId: dto.variantId, packagingOptionId },
      },
      update: { quantity: requestedTotalQuantity },
      create: {
        cartId,
        variantId: dto.variantId,
        packagingOptionId,
        quantity: requestedTotalQuantity,
      },
    });

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
        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_variantId_packagingOptionId: {
              cartId: customerCart.id,
              variantId: guestItem.variantId,
              packagingOptionId: guestItem.packagingOptionId,
            },
          },
        });

        const mergedQuantity = clampQuantity((existing?.quantity ?? 0) + guestItem.quantity);

        await tx.cartItem.upsert({
          where: {
            cartId_variantId_packagingOptionId: {
              cartId: customerCart.id,
              variantId: guestItem.variantId,
              packagingOptionId: guestItem.packagingOptionId,
            },
          },
          update: { quantity: mergedQuantity },
          create: {
            cartId: customerCart.id,
            variantId: guestItem.variantId,
            packagingOptionId: guestItem.packagingOptionId,
            quantity: mergedQuantity,
          },
        });
      }

      // Deleting the cart cascades to its (now-merged) items.
      await tx.cart.delete({ where: { id: guestCart.id } });
    });
  }

  // ---- internal helpers ---------------------------------------------

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
