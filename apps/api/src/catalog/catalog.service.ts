import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ListProductsQueryDto } from "./dto/list-products.dto";
import type { Prisma } from "@prisma/client";
import { availablePackages } from "./inventory.util";
import { resolvePagination, totalPages } from "./pagination.util";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    return this.prisma.category.findMany({
      where: { status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        iconKey: true,
        _count: { select: { products: { where: { status: "ACTIVE" } } } },
      },
    });
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug, status: "ACTIVE" },
      select: {
        id: true,
        slug: true,
        name: true,
        iconKey: true,
        _count: { select: { products: { where: { status: "ACTIVE" } } } },
      },
    });

    if (!category) {
      throw new NotFoundException("دسته‌بندی یافت نشد");
    }

    return category;
  }

  /** Lightweight list for filter UIs — not a producer profile/marketplace page. */
  async listProducers() {
    const producers = await this.prisma.producer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, region: true, verified: true, photo: true },
    });
    return producers.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      region: p.region,
      verified: p.verified,
      photo: p.photo ? { url: p.photo.url, altText: p.photo.altText } : null,
    }));
  }

  async listPackagingOptions() {
    return this.prisma.packagingOption.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, priceDelta: true },
    });
  }

  async listProducts(query: ListProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {
      status: "ACTIVE",
    };

    if (query.q) {
      // No Elasticsearch/full-text-search infra per the locked architecture —
      // plain case-insensitive `contains` across name/description is
      // sufficient for the MVP catalog size.
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
      ];
    }
    if (query.categorySlug) {
      where.category = { slug: query.categorySlug };
    }
    if (query.producerSlug) {
      where.producers = { some: { producer: { slug: query.producerSlug } } };
    }
    if (query.region) {
      where.producers = {
        ...(where.producers as object),
        some: { producer: { region: { contains: query.region, mode: "insensitive" } } },
      };
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.producers = {
        ...(where.producers as object),
        some: {
          variants: {
            some: {
              price: {
                ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
                ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
              },
            },
          },
        },
      };
    }

    // "best_selling" needs each product's confirmed-sale quantity, which
    // isn't a stored column (unlike reviewCount, which — see the schema
    // comment on Product.reviewCount — is a cache with no writer yet, so
    // sorting by it would silently be a no-op: every product reads 0).
    // Real sales live two relation-hops away from Product
    // (Product → ProductProducer → Variant → OrderItem), which Prisma's
    // `orderBy` can't traverse directly, so it's computed here instead:
    // group OrderItem by variant (only counting orders that represent an
    // actual confirmed sale, not pending/cancelled/refunded ones), then
    // roll that up to product-level totals in-process. This only touches
    // aggregated counts (bounded by distinct product count), never raw
    // order rows, so it stays cheap regardless of order-table size.
    const salesByProductId = query.sort === "best_selling" ? await this.soldQuantityByProductId() : null;

    // `inStock` and `priceFrom` are computed from live inventory
    // (on-hand minus reserved grams), not stored columns, so they can't
    // be filtered/sorted in SQL — same reason `price_asc`/`price_desc`/
    // `best_selling`/`inStockOnly` all need the full matching set shaped
    // in-process before paginating, rather than paginating first and
    // sorting/filtering the slice afterward (which would silently make
    // `total`/`totalPages` wrong whenever `inStockOnly` is set, and would
    // sort each page independently rather than the whole result — e.g.
    // page 2 showing cheaper items than page 1 under price_asc). There's
    // no Elasticsearch/full-text-search infra per the locked architecture
    // (see the `q` filter above), so this assumes an MVP-scale catalog
    // that comfortably fits in memory for one request.
    const all = await this.prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: this.productListInclude(),
    });

    let shaped = all.map((p) => this.shapeProductSummary(p));

    if (query.inStockOnly) {
      shaped = shaped.filter((p) => p.inStock);
    }

    if (query.sort === "price_asc") {
      shaped = shaped.sort((a, b) => (a.priceFrom ?? 0) - (b.priceFrom ?? 0));
    } else if (query.sort === "price_desc") {
      shaped = shaped.sort((a, b) => (b.priceFrom ?? 0) - (a.priceFrom ?? 0));
    } else if (query.sort === "best_selling" && salesByProductId) {
      shaped = shaped.sort((a, b) => (salesByProductId.get(b.id) ?? 0) - (salesByProductId.get(a.id) ?? 0));
    }
    // "newest" (or no sort) needs no further work — `all` is already
    // ordered by createdAt desc from the query above.

    const total = shaped.length;
    const { page, pageSize, skip, take } = resolvePagination(query.page, query.pageSize);
    const pageItems = shaped.slice(skip, skip + take);

    return {
      items: pageItems,
      page,
      pageSize,
      total,
      totalPages: totalPages(total, pageSize),
    };
  }

  /**
   * Sums confirmed-sale quantity (see the `listProducts` comment above)
   * per product, for `sort=best_selling`. "Confirmed sale" means the
   * order reached PAID or later in its lifecycle — PENDING_PAYMENT
   * hasn't happened yet, and CANCELLED/REFUNDED shouldn't boost ranking.
   */
  private async soldQuantityByProductId(): Promise<Map<string, number>> {
    const grouped = await this.prisma.orderItem.groupBy({
      by: ["variantId"],
      where: { order: { status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } } },
      _sum: { quantity: true },
    });
    if (grouped.length === 0) return new Map();

    const variants = await this.prisma.variant.findMany({
      where: { id: { in: grouped.map((g) => g.variantId) } },
      select: { id: true, productProducer: { select: { productId: true } } },
    });
    const productIdByVariantId = new Map(variants.map((v) => [v.id, v.productProducer.productId]));

    const totals = new Map<string, number>();
    for (const g of grouped) {
      const productId = productIdByVariantId.get(g.variantId);
      if (!productId) continue; // variant since deleted/orphaned — exclude rather than crash
      const qty = g._sum.quantity ?? 0;
      totals.set(productId, (totals.get(productId) ?? 0) + qty);
    }
    return totals;
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: "ACTIVE" },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        producers: {
          include: {
            producer: true,
            inventory: true,
            variants: { include: { weightOption: true } },
          },
        },
        weightOptions: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!product) {
      throw new NotFoundException("محصول یافت نشد");
    }

    // Packaging options are a global, product-independent list in the
    // current schema (see IMPLEMENTATION_STATUS.md) — shown here for
    // informational display only; cart/order attachment is a later cycle.
    const packagingOptions = await this.listPackagingOptions();

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      harvestSeason: product.harvestSeason,
      category: { slug: product.category.slug, name: product.category.name },
      images: product.images.map((i) => ({ url: i.url, altText: i.altText })),
      avgRating: product.avgRating,
      reviewCount: product.reviewCount,
      weightOptions: product.weightOptions.map((w) => ({ id: w.id, label: w.label, grams: w.grams })),
      producers: product.producers.map((pp) => ({
        productProducerId: pp.id,
        producer: {
          slug: pp.producer.slug,
          name: pp.producer.name,
          region: pp.producer.region,
          bio: pp.producer.bio,
          verified: pp.producer.verified,
        },
        isDefault: pp.isDefault,
        variants: pp.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          price: v.price,
          weightOptionId: v.weightOptionId,
          weightLabel: v.weightOption.label,
          grams: v.weightOption.grams,
          availablePackages: availablePackages(
            pp.inventory?.onHandGrams ?? 0,
            pp.inventory?.reservedGrams ?? 0,
            v.weightOption.grams,
          ),
        })),
      })),
      packagingOptions,
    };
  }

  private productListInclude() {
    return {
      category: true,
      images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
      producers: {
        include: {
          producer: true,
          inventory: true,
          variants: { include: { weightOption: true } },
        },
      },
    } satisfies Prisma.ProductInclude;
  }

  private shapeProductSummary(
    product: Prisma.ProductGetPayload<{ include: ReturnType<CatalogService["productListInclude"]> }>,
  ) {
    const allVariants = product.producers.flatMap((pp) =>
      pp.variants.map((v) => ({
        price: v.price,
        available: availablePackages(
          pp.inventory?.onHandGrams ?? 0,
          pp.inventory?.reservedGrams ?? 0,
          v.weightOption.grams,
        ),
        weightLabel: v.weightOption.label,
      })),
    );

    const inStock = allVariants.some((v) => v.available > 0);
    const distinctPrices = new Set(allVariants.map((v) => v.price));
    const priceFrom = allVariants.length ? Math.min(...allVariants.map((v) => v.price)) : null;
    const defaultProducer = product.producers.find((pp) => pp.isDefault) ?? product.producers[0];

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0] ? { url: product.images[0].url, altText: product.images[0].altText } : null,
      category: { slug: product.category.slug, name: product.category.name },
      producer: defaultProducer
        ? { name: defaultProducer.producer.name, region: defaultProducer.producer.region }
        : null,
      producerCount: product.producers.length,
      weightLabels: [...new Set(allVariants.map((v) => v.weightLabel))],
      priceFrom,
      /** True when more than one distinct price exists across producer/weight combinations — lets the UI show "از" (starting at). Never a per-kg-derived number. */
      hasMultiplePrices: distinctPrices.size > 1,
      inStock,
      lowStock: inStock && allVariants.every((v) => v.available > 0 && v.available <= 3),
      avgRating: product.avgRating,
      reviewCount: product.reviewCount,
    };
  }
}
