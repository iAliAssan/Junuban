import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

/**
 * Append-only audit trail writer for admin-triggered mutations (master
 * prompt §24: "Activity logs must be append-only and appropriate
 * mutations must be recorded"). This is the single place that writes
 * `ActivityLog` rows so every future admin module (products, pricing,
 * discounts, etc.) reuses the same shape rather than each controller
 * hand-rolling its own `prisma.activityLog.create`. There is
 * deliberately no update/delete method here — the model is append-only
 * by contract, not just by convention.
 */
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: {
    adminId: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        adminId: entry.adminId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
    });
  }
}
