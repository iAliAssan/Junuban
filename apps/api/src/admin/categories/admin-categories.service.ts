import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { isValidSlug } from "../../common/util/slug.util";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

/**
 * Admin-facing category management. This is reference data consumed by
 * the product create/edit form's category dropdown
 * (AdminProductsService.listFormOptions) — without this module an admin
 * on a fresh install has no way to create the categories that product
 * creation requires, which would leave that dropdown permanently empty.
 *
 * Deletion is deliberately unsupported: `Product.categoryId` is
 * `onDelete: Restrict`, so a category with any products would fail at
 * the database layer anyway. Hiding (`status: HIDDEN`) is the supported
 * way to retire a category from the storefront while preserving the
 * products/history that reference it.
 */
@Injectable()
export class AdminCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const categories = await this.prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } }, photo: true },
    });
    return {
      items: categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        iconKey: c.iconKey,
        sortOrder: c.sortOrder,
        status: c.status,
        productCount: c._count.products,
        photo: c.photo ? { url: c.photo.url, altText: c.photo.altText } : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  }

  async getById(categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId }, include: { photo: true } });
    if (!category) {
      throw new NotFoundException("دسته‌بندی یافت نشد");
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    await this.assertSlugAvailable(dto.slug);
    return this.prisma.category.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        iconKey: dto.iconKey,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? "ACTIVE",
        ...(dto.photo ? { photo: { create: { url: dto.photo.url, altText: dto.photo.altText } } } : {}),
      },
      include: { photo: true },
    });
  }

  async update(categoryId: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!existing) {
      throw new NotFoundException("دسته‌بندی یافت نشد");
    }
    if (dto.slug && dto.slug !== existing.slug) {
      await this.assertSlugAvailable(dto.slug);
    }

    // Category.photo is a 1:1 optional relation, same reasoning as
    // AdminProducersService.update's photoWrite — three states from the
    // DTO: absent (undefined) = leave unchanged, null = remove, object =
    // upsert (handles both "never had a photo" and "replacing one").
    const photoWrite =
      dto.photo === undefined
        ? {}
        : dto.photo === null
          ? { photo: { delete: true } }
          : {
              photo: {
                upsert: {
                  create: { url: dto.photo.url, altText: dto.photo.altText },
                  update: { url: dto.photo.url, altText: dto.photo.altText },
                },
              },
            };

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        slug: dto.slug,
        name: dto.name,
        iconKey: dto.iconKey,
        sortOrder: dto.sortOrder,
        status: dto.status,
        ...photoWrite,
      },
      include: { photo: true },
    });
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    if (!isValidSlug(slug)) {
      throw new BadRequestException("شناسه (slug) نامعتبر است");
    }
    const existing = await this.prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      throw new ConflictException("این شناسه (slug) قبلاً استفاده شده است");
    }
  }
}
