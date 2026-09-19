import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminProducersService } from "./admin-producers.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { CreateProducerDto } from "./dto/create-producer.dto";
import { UpdateProducerDto } from "./dto/update-producer.dto";
import { AdminSessionGuard, type AdminAuthenticatedRequest } from "../auth/guards/admin-session.guard";

/**
 * Admin producer management. Backs the product create/edit form's
 * producer picker — without this, producers could only ever be seeded
 * directly in the database, which is not a real admin flow. Same
 * authorization boundary and activity-log pattern as
 * AdminProductsController/AdminCategoriesController.
 */
@ApiTags("admin-producers")
@UseGuards(AdminSessionGuard)
@Controller({ path: "admin/producers", version: "1" })
export class AdminProducersController {
  constructor(
    private readonly producers: AdminProducersService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Get()
  list() {
    return this.producers.list();
  }

  @Get(":producerId")
  get(@Param("producerId") producerId: string) {
    return this.producers.getById(producerId);
  }

  @Post()
  async create(@Body() dto: CreateProducerDto, @Req() req: AdminAuthenticatedRequest) {
    const producer = await this.producers.create(dto);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: "producer.create",
      entityType: "Producer",
      entityId: producer.id,
      metadata: { slug: producer.slug, name: producer.name },
    });
    return producer;
  }

  @Patch(":producerId")
  async update(
    @Param("producerId") producerId: string,
    @Body() dto: UpdateProducerDto,
    @Req() req: AdminAuthenticatedRequest,
  ) {
    const producer = await this.producers.update(producerId, dto);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: "producer.update",
      entityType: "Producer",
      entityId: producerId,
      metadata: { slug: producer.slug },
    });
    return producer;
  }
}
