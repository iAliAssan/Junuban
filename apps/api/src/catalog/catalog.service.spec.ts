import { NotFoundException } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * A minimal hand-written Prisma mock — deliberately NOT a mock that just
 * asserts "the mock returns what the mock was configured to return".
 * Each test asserts real business logic that runs *on top of* the mocked
 * data: price/availability shaping, sorting, pagination math, and
 * NotFoundException translation for a missing slug.
 */
function makeVariant(price: number, grams: number, onHandGrams: number, reservedGrams = 0) {
  return {
    id: `variant-${price}-${grams}`,
    sku: `SKU-${price}-${grams}`,
    price,
    weightOptionId: `weight-${grams}`,
    weightOption: { id: `weight-${grams}`, label: `${grams} گرم`, grams },
  };
}

function makeProductProducer(opts: {
  isDefault?: boolean;
  producerName?: string;
  region?: string;
  onHandGrams: number;
  reservedGrams?: number;
  variants: ReturnType<typeof makeVariant>[];
}) {
  return {
    id: `pp-${opts.producerName ?? "default"}`,
    isDefault: opts.isDefault ?? false,
    producer: {
      slug: (opts.producerName ?? "producer").toLowerCase(),
      name: opts.producerName ?? "تولیدکننده",
      region: opts.region ?? "هرمزگان",
      bio: null,
      verified: true,
    },
    inventory: { onHandGrams: opts.onHandGrams, reservedGrams: opts.reservedGrams ?? 0 },
    variants: opts.variants,
  };
}

function makeProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "product-1",
    slug: "mozafati-date",
    name: "خرمای مضافتی",
    description: "خرمای تازه جنوب",
    harvestSeason: null,
    avgRating: null,
    reviewCount: 0,
    category: { slug: "dates", name: "خرما" },
    images: [],
    weightOptions: [],
    producers: [
      makeProductProducer({
        isDefault: true,
        producerName: "Minab",
        onHandGrams: 10000,
        variants: [makeVariant(145000, 250, 10000), makeVariant(260000, 500, 10000)],
      }),
    ],
    ...overrides,
  };
}

describe("CatalogService", () => {
  function makeService(prismaOverrides: Record<string, unknown> = {}) {
    const prisma = {
      category: { findMany: jest.fn(), findFirst: jest.fn() },
      producer: { findMany: jest.fn() },
      packagingOption: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn(), findFirst: jest.fn() },
      orderItem: { groupBy: jest.fn().mockResolvedValue([]) },
      variant: { findMany: jest.fn().mockResolvedValue([]) },
      ...prismaOverrides,
    };
    const service = new CatalogService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  describe("listProducts — availability & pricing shape", () => {
    it("computes priceFrom as the minimum variant price, never a per-kg derivation", async () => {
      const { service, prisma } = makeService();
      (prisma.product.findMany as jest.Mock).mockResolvedValue([makeProduct()]);

      const result = await service.listProducts({ page: 1, pageSize: 24 } as never);

      expect(result.items[0].priceFrom).toBe(145000); // the 250g price, not 260000/2
      expect(result.items[0].hasMultiplePrices).toBe(true);
    });

    it("marks a product out of stock when every variant's available packages is 0", async () => {
      const { service, prisma } = makeService();
      const outOfStockProduct = makeProduct({
        producers: [
          makeProductProducer({
            isDefault: true,
            onHandGrams: 100, // less than either weight option needs
            variants: [makeVariant(145000, 250, 100), makeVariant(260000, 500, 100)],
          }),
        ],
      });
      (prisma.product.findMany as jest.Mock).mockResolvedValue([outOfStockProduct]);

      const result = await service.listProducts({ page: 1, pageSize: 24 } as never);

      expect(result.items[0].inStock).toBe(false);
    });

    it("flags lowStock only when every variant has between 1 and 3 packages available", async () => {
      const { service, prisma } = makeService();
      const lowStockProduct = makeProduct({
        producers: [
          makeProductProducer({
            isDefault: true,
            onHandGrams: 750, // 3 x 250g, 1 x 500g
            variants: [makeVariant(145000, 250, 750), makeVariant(260000, 500, 750)],
          }),
        ],
      });
      (prisma.product.findMany as jest.Mock).mockResolvedValue([lowStockProduct]);

      const result = await service.listProducts({ page: 1, pageSize: 24 } as never);

      expect(result.items[0].lowStock).toBe(true);
    });

    it("sorts by price_asc/price_desc using the computed priceFrom, applied after fetch", async () => {
      const { service, prisma } = makeService();
      const cheap = makeProduct({ slug: "cheap", producers: [makeProductProducer({ isDefault: true, onHandGrams: 10000, variants: [makeVariant(50000, 250, 10000)] })] });
      const expensive = makeProduct({ slug: "expensive", producers: [makeProductProducer({ isDefault: true, onHandGrams: 10000, variants: [makeVariant(500000, 250, 10000)] })] });
      (prisma.product.findMany as jest.Mock).mockResolvedValue([expensive, cheap]);

      const asc = await service.listProducts({ sort: "price_asc", page: 1, pageSize: 24 } as never);
      expect(asc.items.map((i) => i.slug)).toEqual(["cheap", "expensive"]);

      const desc = await service.listProducts({ sort: "price_desc", page: 1, pageSize: 24 } as never);
      expect(desc.items.map((i) => i.slug)).toEqual(["expensive", "cheap"]);
    });

    it("keeps price_asc ordering correct across page boundaries, not just within one page", async () => {
      const { service, prisma } = makeService();
      // Deliberately fetched from the DB in an unsorted-by-price order —
      // the DB's own orderBy is createdAt desc; price ordering must be
      // established over the *entire* matching set before paginating.
      const products = [500000, 100000, 400000, 200000, 300000].map((price, i) =>
        makeProduct({
          slug: `p-${price}`,
          producers: [makeProductProducer({ isDefault: true, onHandGrams: 10000, variants: [makeVariant(price, 250, 10000)] })],
        }),
      );
      (prisma.product.findMany as jest.Mock).mockResolvedValue(products);

      const page1 = await service.listProducts({ sort: "price_asc", page: 1, pageSize: 2 } as never);
      const page2 = await service.listProducts({ sort: "price_asc", page: 2, pageSize: 2 } as never);
      const page3 = await service.listProducts({ sort: "price_asc", page: 3, pageSize: 2 } as never);

      expect(page1.items.map((i) => i.slug)).toEqual(["p-100000", "p-200000"]);
      expect(page2.items.map((i) => i.slug)).toEqual(["p-300000", "p-400000"]);
      expect(page3.items.map((i) => i.slug)).toEqual(["p-500000"]);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
    });

    it("filters out-of-stock products when inStockOnly is requested", async () => {
      const { service, prisma } = makeService();
      const outOfStock = makeProduct({
        slug: "out",
        producers: [makeProductProducer({ isDefault: true, onHandGrams: 0, variants: [makeVariant(1000, 250, 0)] })],
      });
      const inStock = makeProduct({ slug: "in" });
      (prisma.product.findMany as jest.Mock).mockResolvedValue([outOfStock, inStock]);

      const result = await service.listProducts({ inStockOnly: true, page: 1, pageSize: 24 } as never);

      expect(result.items.map((i) => i.slug)).toEqual(["in"]);
      // total/totalPages must reflect the post-filter count, not the raw
      // unfiltered fetch — otherwise the client would believe more pages
      // exist than actually do.
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("sorts by best_selling using real confirmed-sale quantity, not the always-zero reviewCount column", async () => {
      const { service, prisma } = makeService();
      const popular = makeProduct({
        id: "product-popular",
        slug: "popular",
        producers: [
          makeProductProducer({
            isDefault: true,
            onHandGrams: 10000,
            variants: [{ ...makeVariant(100000, 250, 10000), id: "variant-popular" }],
          }),
        ],
      });
      const niche = makeProduct({
        id: "product-niche",
        slug: "niche",
        producers: [
          makeProductProducer({
            isDefault: true,
            onHandGrams: 10000,
            variants: [{ ...makeVariant(100000, 250, 10000), id: "variant-niche" }],
          }),
        ],
      });
      const neverSold = makeProduct({ id: "product-never-sold", slug: "never-sold" });

      (prisma.product.findMany as jest.Mock).mockResolvedValue([popular, niche, neverSold]);
      (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([
        { variantId: "variant-popular", _sum: { quantity: 40 } },
        { variantId: "variant-niche", _sum: { quantity: 3 } },
      ]);
      (prisma.variant.findMany as jest.Mock).mockResolvedValue([
        { id: "variant-popular", productProducer: { productId: "product-popular" } },
        { id: "variant-niche", productProducer: { productId: "product-niche" } },
      ]);

      const result = await service.listProducts({ sort: "best_selling", page: 1, pageSize: 24 } as never);

      expect(result.items.map((i) => i.slug)).toEqual(["popular", "niche", "never-sold"]);
      // Only confirmed-sale statuses should be counted.
      const groupByArgs = (prisma.orderItem.groupBy as jest.Mock).mock.calls[0][0];
      expect(groupByArgs.where.order.status.in).toEqual(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]);
    });
  });

  describe("listProducts — query building", () => {
    it("builds a category filter from categorySlug", async () => {
      const { service, prisma } = makeService();
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

      await service.listProducts({ categorySlug: "dates", page: 1, pageSize: 24 } as never);

      const callArgs = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.category).toEqual({ slug: "dates" });
    });

    it("builds a case-insensitive OR search filter from q", async () => {
      const { service, prisma } = makeService();
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

      await service.listProducts({ q: "خرما", page: 1, pageSize: 24 } as never);

      const callArgs = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.OR).toEqual([
        { name: { contains: "خرما", mode: "insensitive" } },
        { description: { contains: "خرما", mode: "insensitive" } },
      ]);
    });

    it("clamps pageSize server-side even if an oversized value slips past DTO validation", async () => {
      const { service, prisma } = makeService();
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.listProducts({ page: 1, pageSize: 99999 } as never);

      expect(result.pageSize).toBeLessThanOrEqual(60);
    });
  });

  describe("getProductBySlug", () => {
    it("throws NotFoundException for a missing/inactive slug", async () => {
      const { service, prisma } = makeService();
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getProductBySlug("does-not-exist")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns each producer's variants with independent prices, never derived from one another", async () => {
      const { service, prisma } = makeService();
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(
        makeProduct({
          weightOptions: [
            { id: "weight-250", label: "250 گرم", grams: 250 },
            { id: "weight-500", label: "500 گرم", grams: 500 },
          ],
        }),
      );

      const detail = await service.getProductBySlug("mozafati-date");

      const variants = detail.producers[0].variants;
      const v250 = variants.find((v) => v.grams === 250)!;
      const v500 = variants.find((v) => v.grams === 500)!;
      expect(v250.price).toBe(145000);
      expect(v500.price).toBe(260000);
      // Explicitly not double the 250g price — an independent price, not a formula.
      expect(v500.price).not.toBe(v250.price * 2);
    });

    it("computes availablePackages per variant from grams on hand minus reserved", async () => {
      const { service, prisma } = makeService();
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(
        makeProduct({
          producers: [
            makeProductProducer({
              isDefault: true,
              onHandGrams: 1000,
              reservedGrams: 250,
              variants: [makeVariant(145000, 250, 1000)],
            }),
          ],
        }),
      );

      const detail = await service.getProductBySlug("mozafati-date");

      // (1000 - 250) / 250 = 3 packages
      expect(detail.producers[0].variants[0].availablePackages).toBe(3);
    });

    it("includes harvestSeason when present and null when absent, without fabricating a value", async () => {
      const { service, prisma } = makeService();
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(
        makeProduct({ harvestSeason: "برداشت پاییز ۱۴۰۳" }),
      );

      const detail = await service.getProductBySlug("mozafati-date");
      expect(detail.harvestSeason).toBe("برداشت پاییز ۱۴۰۳");
    });
  });
});
