import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateAddressDto } from "./dto/create-address.dto";
import type { UpdateAddressDto } from "./dto/update-address.dto";

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCustomer(customerId: string) {
    return this.prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async create(customerId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      return this.prisma.$transaction(async (tx) => {
        await tx.address.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
        return tx.address.create({ data: { ...dto, customerId, isDefault: true } });
      });
    }

    // A customer's very first address becomes the default automatically —
    // otherwise checkout would have no sensible pre-selected address.
    const existingCount = await this.prisma.address.count({ where: { customerId } });
    return this.prisma.address.create({
      data: { ...dto, customerId, isDefault: existingCount === 0 },
    });
  }

  async update(customerId: string, addressId: string, dto: UpdateAddressDto) {
    await this.assertOwnership(customerId, addressId);

    if (dto.isDefault) {
      return this.prisma.$transaction(async (tx) => {
        await tx.address.updateMany({
          where: { customerId, isDefault: true, id: { not: addressId } },
          data: { isDefault: false },
        });
        return tx.address.update({ where: { id: addressId }, data: dto });
      });
    }

    return this.prisma.address.update({ where: { id: addressId }, data: dto });
  }

  async remove(customerId: string, addressId: string): Promise<void> {
    await this.assertOwnership(customerId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
  }

  /** Used by OrdersService when checkout references an existing address by id — never trusts the id without checking ownership. */
  async getOwned(customerId: string, addressId: string) {
    return this.assertOwnership(customerId, addressId);
  }

  private async assertOwnership(customerId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address) {
      throw new NotFoundException("آدرس یافت نشد");
    }
    if (address.customerId !== customerId) {
      throw new ForbiddenException("شما اجازه دسترسی به این آدرس را ندارید");
    }
    return address;
  }
}
