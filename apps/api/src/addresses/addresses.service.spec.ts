import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AddressesService } from "./addresses.service";
import type { PrismaService } from "../prisma/prisma.service";

describe("AddressesService", () => {
  function makeService() {
    const txMock = {
      address: {
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "addr-new", isDefault: true }),
        update: jest.fn().mockResolvedValue({ id: "addr-1", isDefault: true }),
      },
    };
    const prisma = {
      address: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
    };
    const service = new AddressesService(prisma as unknown as PrismaService);
    return { service, prisma, txMock };
  }

  describe("create", () => {
    it("makes the customer's first address the default automatically", async () => {
      const { service, prisma } = makeService();
      (prisma.address.count as jest.Mock).mockResolvedValue(0);
      await service.create("customer-1", {
        recipientName: "علی",
        phone: "09121234567",
        province: "تهران",
        city: "تهران",
        addressLine: "خیابان آزادی",
        postalCode: "1234567890",
      });
      const createArgs = (prisma.address.create as jest.Mock).mock.calls[0][0];
      expect(createArgs.data.isDefault).toBe(true);
    });

    it("does not default a second address unless explicitly requested", async () => {
      const { service, prisma } = makeService();
      (prisma.address.count as jest.Mock).mockResolvedValue(1);
      await service.create("customer-1", {
        recipientName: "علی",
        phone: "09121234567",
        province: "تهران",
        city: "تهران",
        addressLine: "خیابان آزادی",
        postalCode: "1234567890",
      });
      const createArgs = (prisma.address.create as jest.Mock).mock.calls[0][0];
      expect(createArgs.data.isDefault).toBe(false);
    });

    it("unsets the previous default when isDefault:true is explicitly requested", async () => {
      const { service, txMock } = makeService();
      await service.create("customer-1", {
        recipientName: "علی",
        phone: "09121234567",
        province: "تهران",
        city: "تهران",
        addressLine: "خیابان آزادی",
        postalCode: "1234567890",
        isDefault: true,
      });
      expect(txMock.address.updateMany).toHaveBeenCalledWith({
        where: { customerId: "customer-1", isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe("ownership checks (update/remove/getOwned)", () => {
    it("throws NotFoundException for a nonexistent address", async () => {
      const { service, prisma } = makeService();
      (prisma.address.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getOwned("customer-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ForbiddenException when the address belongs to another customer", async () => {
      const { service, prisma } = makeService();
      (prisma.address.findUnique as jest.Mock).mockResolvedValue({ id: "addr-1", customerId: "someone-else" });
      await expect(service.getOwned("customer-1", "addr-1")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("returns the address when owned by the requesting customer", async () => {
      const { service, prisma } = makeService();
      (prisma.address.findUnique as jest.Mock).mockResolvedValue({ id: "addr-1", customerId: "customer-1" });
      await expect(service.getOwned("customer-1", "addr-1")).resolves.toMatchObject({ id: "addr-1" });
    });

    it("rejects removing another customer's address rather than silently no-op-ing", async () => {
      const { service, prisma } = makeService();
      (prisma.address.findUnique as jest.Mock).mockResolvedValue({ id: "addr-1", customerId: "someone-else" });
      await expect(service.remove("customer-1", "addr-1")).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.address.delete).not.toHaveBeenCalled();
    });
  });
});
