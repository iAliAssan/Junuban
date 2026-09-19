import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminPackagingOptionsService } from "./admin-packaging-options.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { CreatePackagingOptionDto } from "./dto/create-packaging-option.dto";
import { UpdatePackagingOptionDto } from "./dto/update-packaging-option.dto";
import { AdminSessionGuard, type AdminAuthenticatedRequest } from "../auth/guards/admin-session.guard";

/**
 * Admin packaging-option management. Backs the cart/checkout packaging
 * picker's reference data — see AdminPackagingOptionsService's doc
 * comment for why there's no delete route. Same auth/activity-log
 * pattern as AdminCategoriesController/AdminProducersController.
 */
@ApiTags("admin-packaging-options")
@UseGuards(AdminSessionGuard)
@Controller({ path: "admin/packaging-options", version: "1" })
export class AdminPackagingOptionsController {
  constructor(
    private readonly packagingOptions: AdminPackagingOptionsService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Get()
  list() {
    return this.packagingOptions.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.packagingOptions.getById(id);
  }

  @Post()
  async create(@Body() dto: CreatePackagingOptionDto, @Req() req: AdminAuthenticatedRequest) {
    const option = await this.packagingOptions.create(dto);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: "packaging_option.create",
      entityType: "PackagingOption",
      entityId: option.id,
      metadata: { name: option.name, priceDelta: option.priceDelta },
    });
    return option;
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdatePackagingOptionDto, @Req() req: AdminAuthenticatedRequest) {
    const option = await this.packagingOptions.update(id, dto);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: "packaging_option.update",
      entityType: "PackagingOption",
      entityId: id,
      metadata: { name: option.name },
    });
    return option;
  }
}
