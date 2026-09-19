import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { resolvePagination, totalPages } from "../../catalog/pagination.util";
import { availablePackages } from "../../catalog/inventory.util";
import { isValidSlug } from "../../common/util/slug.util";
import type { ListAdminProductsQueryDto } from "./dto/list-admin-products.dto";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";
import type { ProductProducerInputDto, VariantInputDto, WeightOptionInputDto } from "./dto/product-nested.dto";
import type { Prisma } from "@prisma/client";

const ADMIN_PRODUCT_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: "asc" as const } },
  weightOptions: { orderBy: { sortOrder: "asc" as const } },
  producers: {
    include: {
      producer: true,
      inventory: true,
      variants: { include: { weightOption: true } },
    },
  },
} satisfies Prisma.ProductInclude;

type AdminProductWithRelations = Prisma.ProductGetPayload<{ include: typeof ADMIN_PRODUCT_INCLUDE }>;

/**
 * Admin-facing product catalog management: list/detail/create/update and
 * publish/unpublish. Reuses the exact pagination (`resolvePagination`/
 * `totalPages`) and inventory (`availablePackages`) helpers the public
 * `CatalogService` already relies on, per master prompt §17/§26 ("do not
 * duplicate business logic that already exists elsewhere") — this
 * service owns the *admin write* path only; the public read path in
 * CatalogService is untouched.
 *
 * The nested producers/weightOptions/media arrays are each treated as a
 * full replacement set on create AND on update (see `syncNestedRelations`):
 * an entry with an `id` updates that row, an entry without one creates a
 * new row, and any existing row of that relation not present in the
 * array is removed. This mirrors how the admin UI's edit form actually
 * works (it always submits the complete current set, since a form field
 * for "this variant was deleted" doesn't otherwise exist) and avoids the
 * much harder alternative of a separate add/remove/reorder endpoint per
 * nested relation for a first admin-products cycle.
 */
@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Category/producer options for the create/edit form's dropdowns.
   * Deliberately NOT `CatalogService.listCategories`/`listProducers` —
   * those are public-storefront reads scoped to ACTIVE only, whereas an
   * admin assigning a product must be able to see (and pick) an INACTIVE
   * category too, e.g. while preparing a product ahead of that
   * category's own launch. A distinct admin-scoped query, not a
   * parameter bolted onto the public one, keeps the public contract
   * (and its caching/assumptions) unchanged.
   */
  async listFormOptions() {
    const [categories, producers] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true, status: true },
      }),
      this.prisma.producer.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, region: true, status: true },
      }),
    ]);
    return { categories, producers };
  }

  async list(query: ListAdminProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { slug: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const { page, pageSize, skip, take } = resolvePagination(query.page, query.pageSize);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: ADMIN_PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((p) => this.shapeListItem(p)),
      page,
      pageSize,
      total,
      totalPages: totalPages(total, pageSize),
    };
  }

  async getById(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: ADMIN_PRODUCT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException("محصول یافت نشد");
    }
    return this.shapeDetail(product);
  }

  /**
   * New products are always created DRAFT regardless of `dto.status` —
   * an admin should never accidentally make a half-configured product
   * (no reviewed media, an untested price) instantly ACTIVE by omitting
   * the field or leaving a stale default in a form. Publishing is a
   * deliberate, separate action (`setStatus`), which is also what makes
   * "publish" a distinctly logged activity-log action rather than being
   * indistinguishable from any other edit.
   */
  async create(dto: CreateProductDto) {
    await this.assertSlugAvailable(dto.slug);
    await this.assertCategoryExists(dto.categoryId);

    const created = await this.prisma.runSerializable(async (tx) => {
      const product = await tx.product.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          description: dto.description,
          categoryId: dto.categoryId,
          type: dto.type ?? "SIMPLE",
          status: "DRAFT",
          harvestSeason: dto.harvestSeason,
          metaTitle: dto.metaTitle,
          metaDescription: dto.metaDescription,
        },
      });

      await this.syncNestedRelations(tx, product.id, {
        weightOptions: dto.weightOptions,
        producers: dto.producers,
        media: dto.media,
      });

      return product.id;
    });

    return this.getById(created);
  }

  /**
   * Partial update. Scalar fields are applied only when present in the
   * DTO; the three nested-relation arrays (weightOptions/producers/media)
   * are, when present, treated as the complete replacement set for that
   * relation (see class docblock) — omitting one of these arrays entirely
   * leaves that relation completely untouched.
   */
  async update(productId: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new NotFoundException("محصول یافت نشد");
    }

    if (dto.slug && dto.slug !== existing.slug) {
      await this.assertSlugAvailable(dto.slug);
    }
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    await this.prisma.runSerializable(async (tx) => {
      const scalarData: Prisma.ProductUpdateInput = {};
      if (dto.slug !== undefined) scalarData.slug = dto.slug;
      if (dto.name !== undefined) scalarData.name = dto.name;
      if (dto.description !== undefined) scalarData.description = dto.description;
      if (dto.categoryId !== undefined) scalarData.category = { connect: { id: dto.categoryId } };
      if (dto.type !== undefined) scalarData.type = dto.type;
      if (dto.status !== undefined) scalarData.status = dto.status;
      if (dto.harvestSeason !== undefined) scalarData.harvestSeason = dto.harvestSeason;
      if (dto.metaTitle !== undefined) scalarData.metaTitle = dto.metaTitle;
      if (dto.metaDescription !== undefined) scalarData.metaDescription = dto.metaDescription;

      if (Object.keys(scalarData).length > 0) {
        await tx.product.update({ where: { id: productId }, data: scalarData });
      }

      await this.syncNestedRelations(tx, productId, {
        weightOptions: dto.weightOptions,
        producers: dto.producers,
        media: dto.media,
      });
    });

    return this.getById(productId);
  }

  /**
   * The dedicated publish/unpublish action (master prompt Cycle 13:
   * "Publish/unpublish controls" distinct from the general edit form).
   * ARCHIVED products are excluded — archiving is a terminal state set
   * only via the general update path, not toggled back on from here.
   */
  async setStatus(productId: string, status: "ACTIVE" | "DRAFT") {
    const existing = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new NotFoundException("محصول یافت نشد");
    }
    if (existing.status === "ARCHIVED") {
      throw new BadRequestException("محصول بایگانی‌شده را نمی‌توان مستقیم منتشر کرد");
    }

    return this.prisma.product.update({ where: { id: productId }, data: { status } });
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    if (!isValidSlug(slug)) {
      throw new BadRequestException("شناسه (slug) نامعتبر است");
    }
    const existing = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      throw new ConflictException("این شناسه (slug) قبلاً استفاده شده است");
    }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) {
      throw new BadRequestException("دسته‌بندی انتخاب‌شده یافت نشد");
    }
  }

  /**
   * Replaces weightOptions/producers(+variants+inventory)/media for one
   * product with exactly what was submitted, inside the caller's
   * transaction. Runs in dependency order (weight options before
   * producers, since variants reference weightOptionId) and validates
   * that every `variant.weightOptionId` in the payload actually matches
   * one of the weightOptions in the SAME payload — a cross-array check
   * that only makes sense here, not at the per-field DTO level.
   */
  private async syncNestedRelations(
    tx: Prisma.TransactionClient,
    productId: string,
    input: {
      weightOptions?: WeightOptionInputDto[];
      producers?: ProductProducerInputDto[];
      media?: { id?: string; url: string; altText: string; sortOrder?: number }[];
    },
  ): Promise<void> {
    // ---- Weight options ----------------------------------------------
    let weightOptionIdByPayloadRef: Map<string, string> | undefined;
    if (input.weightOptions) {
      const grams = input.weightOptions.map((w) => w.grams);
      if (new Set(grams).size !== grams.length) {
        throw new BadRequestException("هر گزینه وزنی باید یک مقدار گرم منحصربه‌فرد داشته باشد");
      }

      const existingRows = await tx.weightOption.findMany({ where: { productId }, select: { id: true } });
      const existingIds = new Set(existingRows.map((r) => r.id));
      const keptIds = new Set<string>();
      weightOptionIdByPayloadRef = new Map();

      for (const [index, w] of input.weightOptions.entries()) {
        if (w.id && existingIds.has(w.id)) {
          await tx.weightOption.update({
            where: { id: w.id },
            data: { label: w.label, grams: w.grams, sortOrder: w.sortOrder ?? index },
          });
          keptIds.add(w.id);
          weightOptionIdByPayloadRef.set(w.id, w.id);
        } else {
          const created = await tx.weightOption.create({
            data: { productId, label: w.label, grams: w.grams, sortOrder: w.sortOrder ?? index },
          });
          keptIds.add(created.id);
          // A newly created weight option is also addressable by its
          // temporary payload id (if the admin UI generated one client-side
          // for the variant.weightOptionId cross-reference below) as well
          // as by its own grams value, so a variant referencing either
          // still resolves correctly within this same request.
          weightOptionIdByPayloadRef.set(String(w.grams), created.id);
          if (w.id) weightOptionIdByPayloadRef.set(w.id, created.id);
        }
      }

      const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
      if (removedIds.length > 0) {
        // onDelete: Restrict on Variant.weightOption — Prisma will throw
        // a real FK-violation error (surfaced by HttpExceptionFilter as a
        // 500) if the admin tries to remove a weight option that still
        // has variants pointing at it and those variants weren't also
        // removed in the same request. That is the correct behavior:
        // silently cascading here could delete sellable variants no one
        // asked to delete.
        await tx.weightOption.deleteMany({ where: { id: { in: removedIds } } });
      }
    }

    // ---- Producers + inventory + variants -----------------------------
    if (input.producers) {
      const resolveWeightOptionId = async (ref: string): Promise<string> => {
        const mapped = weightOptionIdByPayloadRef?.get(ref);
        if (mapped) return mapped;
        // No weightOptions array was sent in this request (update-only-
        // producers case) — the ref must already be a real, existing id.
        const row = await tx.weightOption.findFirst({ where: { id: ref, productId }, select: { id: true } });
        if (!row) {
          throw new BadRequestException("گزینه وزنی انتخاب‌شده برای یکی از تنوع‌ها معتبر نیست");
        }
        return row.id;
      };

      const existingLinks = await tx.productProducer.findMany({
        where: { productId },
        select: { id: true },
      });
      const existingLinkIds = new Set(existingLinks.map((r) => r.id));
      const keptLinkIds = new Set<string>();

      const defaultCount = input.producers.filter((p) => p.isDefault).length;
      if (defaultCount > 1) {
        throw new BadRequestException("فقط یک تولیدکننده می‌تواند پیش‌فرض باشد");
      }

      for (const p of input.producers) {
        const producer = await tx.producer.findUnique({ where: { id: p.producerId }, select: { id: true } });
        if (!producer) {
          throw new BadRequestException("تولیدکننده انتخاب‌شده یافت نشد");
        }

        let productProducerId: string;
        if (p.id && existingLinkIds.has(p.id)) {
          await tx.productProducer.update({
            where: { id: p.id },
            data: { producerId: p.producerId, isDefault: p.isDefault ?? false },
          });
          productProducerId = p.id;
        } else {
          const created = await tx.productProducer.create({
            data: { productId, producerId: p.producerId, isDefault: p.isDefault ?? false },
          });
          productProducerId = created.id;
        }
        keptLinkIds.add(productProducerId);

        if (p.onHandGrams !== undefined || p.lowStockThresholdGrams !== undefined) {
          await tx.inventory.upsert({
            where: { productProducerId },
            create: {
              productProducerId,
              onHandGrams: p.onHandGrams ?? 0,
              lowStockThresholdGrams: p.lowStockThresholdGrams,
            },
            // Deliberately does NOT touch reservedGrams — that column is
            // owned exclusively by the checkout/reservation flow
            // (OrdersService), never by this admin edit path, so an
            // admin editing on-hand stock can never accidentally wipe
            // out an in-flight customer reservation.
            update: {
              ...(p.onHandGrams !== undefined ? { onHandGrams: p.onHandGrams } : {}),
              ...(p.lowStockThresholdGrams !== undefined ? { lowStockThresholdGrams: p.lowStockThresholdGrams } : {}),
            },
          });
        }

        // ---- Variants for this producer link ----
        const existingVariants = await tx.variant.findMany({
          where: { productProducerId },
          select: { id: true },
        });
        const existingVariantIds = new Set(existingVariants.map((r) => r.id));
        const keptVariantIds = new Set<string>();

        for (const v of p.variants as VariantInputDto[]) {
          const weightOptionId = await resolveWeightOptionId(v.weightOptionId);

          if (v.id && existingVariantIds.has(v.id)) {
            await tx.variant.update({
              where: { id: v.id },
              data: {
                weightOptionId,
                price: v.price,
                isActive: v.isActive ?? true,
                ...(v.sku ? { sku: v.sku } : {}),
              },
            });
            keptVariantIds.add(v.id);
          } else {
            const sku = v.sku ?? (await this.generateUniqueSku(tx));
            const created = await tx.variant.create({
              data: {
                productProducerId,
                weightOptionId,
                price: v.price,
                sku,
                isActive: v.isActive ?? true,
              },
            });
            keptVariantIds.add(created.id);
          }
        }

        const removedVariantIds = [...existingVariantIds].filter((id) => !keptVariantIds.has(id));
        if (removedVariantIds.length > 0) {
          // onDelete: Restrict on OrderItem/InventoryReservation ->
          // Variant means Prisma will refuse to delete a variant that
          // has ever been ordered or is currently reserved — correct:
          // sold/reserved history must never silently disappear because
          // an admin edited the product form.
          await tx.variant.deleteMany({ where: { id: { in: removedVariantIds } } });
        }
      }

      const removedLinkIds = [...existingLinkIds].filter((id) => !keptLinkIds.has(id));
      if (removedLinkIds.length > 0) {
        await tx.productProducer.deleteMany({ where: { id: { in: removedLinkIds } } });
      }
    }

    // ---- Media ----------------------------------------------------------
    if (input.media) {
      const existingMedia = await tx.media.findMany({ where: { productId }, select: { id: true } });
      const existingMediaIds = new Set(existingMedia.map((r) => r.id));
      const keptMediaIds = new Set<string>();

      for (const [index, m] of input.media.entries()) {
        if (m.id && existingMediaIds.has(m.id)) {
          await tx.media.update({
            where: { id: m.id },
            data: { url: m.url, altText: m.altText, sortOrder: m.sortOrder ?? index },
          });
          keptMediaIds.add(m.id);
        } else {
          const created = await tx.media.create({
            data: { productId, url: m.url, altText: m.altText, sortOrder: m.sortOrder ?? index },
          });
          keptMediaIds.add(created.id);
        }
      }

      const removedMediaIds = [...existingMediaIds].filter((id) => !keptMediaIds.has(id));
      if (removedMediaIds.length > 0) {
        await tx.media.deleteMany({ where: { id: { in: removedMediaIds } } });
      }
    }
  }

  /** Collision-safe fallback SKU when the admin leaves the field blank. */
  private async generateUniqueSku(tx: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `SKU-${randomBytes(4).toString("hex").toUpperCase()}`;
      const clash = await tx.variant.findUnique({ where: { sku: candidate }, select: { id: true } });
      if (!clash) return candidate;
    }
    throw new ConflictException("تولید شناسه کالا (SKU) ناموفق بود، لطفاً دوباره تلاش کنید");
  }

  private shapeListItem(product: AdminProductWithRelations) {
    const allVariants = product.producers.flatMap((pp) => pp.variants);
    const priceFrom = allVariants.length ? Math.min(...allVariants.map((v) => v.price)) : null;
    const totalOnHandGrams = product.producers.reduce((sum, pp) => sum + (pp.inventory?.onHandGrams ?? 0), 0);

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      status: product.status,
      category: { id: product.category.id, name: product.category.name },
      image: product.images[0] ? { url: product.images[0].url, altText: product.images[0].altText } : null,
      producerCount: product.producers.length,
      variantCount: allVariants.length,
      priceFrom,
      totalOnHandGrams,
      updatedAt: product.updatedAt,
    };
  }

  private shapeDetail(product: AdminProductWithRelations) {
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      status: product.status,
      type: product.type,
      harvestSeason: product.harvestSeason,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      category: { id: product.category.id, slug: product.category.slug, name: product.category.name },
      images: product.images.map((i) => ({ id: i.id, url: i.url, altText: i.altText, sortOrder: i.sortOrder })),
      weightOptions: product.weightOptions.map((w) => ({
        id: w.id,
        label: w.label,
        grams: w.grams,
        sortOrder: w.sortOrder,
      })),
      producers: product.producers.map((pp) => ({
        id: pp.id,
        producerId: pp.producerId,
        producerName: pp.producer.name,
        isDefault: pp.isDefault,
        onHandGrams: pp.inventory?.onHandGrams ?? 0,
        reservedGrams: pp.inventory?.reservedGrams ?? 0,
        lowStockThresholdGrams: pp.inventory?.lowStockThresholdGrams ?? null,
        variants: pp.variants.map((v) => ({
          id: v.id,
          weightOptionId: v.weightOptionId,
          weightLabel: v.weightOption.label,
          grams: v.weightOption.grams,
          price: v.price,
          sku: v.sku,
          isActive: v.isActive,
          availablePackages: availablePackages(
            pp.inventory?.onHandGrams ?? 0,
            pp.inventory?.reservedGrams ?? 0,
            v.weightOption.grams,
          ),
        })),
      })),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
