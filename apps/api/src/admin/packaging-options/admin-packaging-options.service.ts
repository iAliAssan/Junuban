import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreatePackagingOptionDto } from "./dto/create-packaging-option.dto";
import type { UpdatePackagingOptionDto } from "./dto/update-packaging-option.dto";

/**
 * Admin-facing packaging-option management. The public catalog endpoint
 * (`CatalogService.listPackagingOptions`, `GET /packaging-options`) only
 * lists `isActive: true` rows in `sortOrder` order and is consumed by
 * the cart/checkout packaging picker (see CartService's
 * `packagingPriceDelta` handling) — until this module existed, these
 * rows could only ever be seeded directly in the database, with no real
 * admin flow to add a new packaging tier (e.g. a seasonal gift-box
 * option) or retire one.
 *
 * No delete endpoint: `PackagingOption.cartItems`/`orderItems` reference
 * it, including from past, already-completed orders, so deleting a row
 * that any historical order used would corrupt that order's own
 * historical record. Deactivating (`isActive: false`) is the supported
 * way to retire an option from new carts while preserving order history
 * — same pattern as Category/Producer's `status: HIDDEN`.
 */
@Injectable()
export class AdminPackagingOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.packagingOption.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async getById(id: string) {
    const option = await this.prisma.packagingOption.findUnique({ where: { id } });
    if (!option) {
      throw new NotFoundException("گزینه بسته‌بندی یافت نشد");
    }
    return option;
  }

  async create(dto: CreatePackagingOptionDto) {
    return this.prisma.packagingOption.create({
      data: {
        name: dto.name,
        priceDelta: dto.priceDelta ?? 0,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdatePackagingOptionDto) {
    await this.getById(id); // 404s before Prisma's own "record not found" throw, for a clearer error
    return this.prisma.packagingOption.update({
      where: { id },
      data: {
        name: dto.name,
        priceDelta: dto.priceDelta,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
    });
  }
}
