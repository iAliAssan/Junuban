import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { isValidSlug } from "../../common/util/slug.util";
import type { CreateProducerDto } from "./dto/create-producer.dto";
import type { UpdateProducerDto } from "./dto/update-producer.dto";

/**
 * Admin-facing producer management. This is reference data consumed by
 * the product create/edit form's producer picker
 * (AdminProductsService.listFormOptions) — without this module an admin
 * on a fresh install has no way to create the producers that linking a
 * product to a supplier requires.
 *
 * Deletion is deliberately unsupported: `ProductProducer.producer` is
 * `onDelete: Restrict`, so a producer already linked to any product
 * would fail at the database layer anyway. Hiding (`status: HIDDEN`) is
 * the supported way to retire a producer from the storefront while
 * preserving the product links/inventory history that reference it.
 */
@Injectable()
export class AdminProducersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const producers = await this.prisma.producer.findMany({
      orderBy: { name: "asc" },
      include: { photo: true, _count: { select: { productLinks: true } } },
    });
    return {
      items: producers.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        bio: p.bio,
        region: p.region,
        province: p.province,
        verified: p.verified,
        status: p.status,
        photo: p.photo ? { url: p.photo.url, altText: p.photo.altText } : null,
        productCount: p._count.productLinks,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  }

  async getById(producerId: string) {
    const producer = await this.prisma.producer.findUnique({
      where: { id: producerId },
      include: { photo: true },
    });
    if (!producer) {
      throw new NotFoundException("تولیدکننده یافت نشد");
    }
    return producer;
  }

  async create(dto: CreateProducerDto) {
    await this.assertSlugAvailable(dto.slug);
    return this.prisma.producer.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        bio: dto.bio,
        region: dto.region,
        province: dto.province,
        verified: dto.verified ?? false,
        status: dto.status ?? "ACTIVE",
        // dto.photo is `undefined` unless the caller explicitly sent a
        // `photo` object on create — nothing to create yet in that case.
        ...(dto.photo ? { photo: { create: { url: dto.photo.url, altText: dto.photo.altText } } } : {}),
      },
      include: { photo: true },
    });
  }

  async update(producerId: string, dto: UpdateProducerDto) {
    const existing = await this.prisma.producer.findUnique({ where: { id: producerId } });
    if (!existing) {
      throw new NotFoundException("تولیدکننده یافت نشد");
    }
    if (dto.slug && dto.slug !== existing.slug) {
      await this.assertSlugAvailable(dto.slug);
    }

    // Producer.photo is a 1:1 optional relation (Media.producerId is
    // @unique), so "set the photo" needs Prisma's nested relation
    // write, not a plain scalar assignment. Three distinct states from
    // the DTO (see SinglePhotoInputDto's own doc comment):
    //   - `photo` key absent from the request body → dto.photo is
    //     `undefined` → leave the existing photo (or lack of one)
    //     untouched entirely (no `photo` key passed to Prisma at all).
    //   - `photo: null` → explicit removal → `{ delete: true }` (a
    //     no-op if there was no photo to begin with, since a null
    //     optional relation has nothing to delete).
    //   - `photo: { url, altText }` → upsert → `{ upsert: { ... } }`
    //     handles both "producer never had a photo" and "replacing an
    //     existing one" in a single nested write.
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

    return this.prisma.producer.update({
      where: { id: producerId },
      data: {
        slug: dto.slug,
        name: dto.name,
        bio: dto.bio,
        region: dto.region,
        province: dto.province,
        verified: dto.verified,
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
    const existing = await this.prisma.producer.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      throw new ConflictException("این شناسه (slug) قبلاً استفاده شده است");
    }
  }
}
