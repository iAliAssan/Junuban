import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";
import { ListActivityLogQueryDto } from "./dto/list-activity-log.dto";
import { AdminSessionGuard } from "../auth/guards/admin-session.guard";
import { AdminOwnerGuard } from "../auth/guards/admin-owner.guard";

/**
 * Read access to the append-only activity log. Per master prompt §24
 * ("Owner-only activity log access must remain owner-only"), this is
 * gated by BOTH guards, in order: AdminSessionGuard establishes who is
 * calling, then AdminOwnerGuard rejects anyone who isn't OWNER. Staff
 * cannot reach this route regardless of any frontend behavior.
 */
@ApiTags("admin-activity-log")
@UseGuards(AdminSessionGuard, AdminOwnerGuard)
@Controller({ path: "admin/activity-log", version: "1" })
export class ActivityLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: ListActivityLogQueryDto) {
    const { page, pageSize } = query;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        include: { admin: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.activityLog.count(),
    ]);
    return { items, total, page, pageSize };
  }
}
