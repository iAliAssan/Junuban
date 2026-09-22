import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminCategoriesService } from "./admin-categories.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { AdminSessionGuard, type AdminAuthenticatedRequest } from "../auth/guards/admin-session.guard";

/**
 * Admin category management. Backs the product create/edit form's
 * category dropdown — without this, categories could only ever be
 * seeded directly in the database, which is not a real admin flow.
 * Same authorization boundary and activity-log pattern as
 * AdminProductsController.
 */
@ApiTags("admin-categories")
@UseGuards(AdminSessionGuard)
@Controller({ path: "admin/categories", version: "1" })
export class AdminCategoriesController {
  constructor(
    private readonly categories: AdminCategoriesService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Get(":categoryId")
  get(@Param("categoryId") categoryId: string) {
    return this.categories.getById(categoryId);
  }

  @Post()
  async create(@Body() dto: CreateCategoryDto, @Req() req: AdminAuthenticatedRequest) {
    const category = await this.categories.create(dto);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: "category.create",
      entityType: "Category",
      entityId: category.id,
      metadata: { slug: category.slug, name: category.name },
    });
    return category;
  }

  @Patch(":categoryId")
  async update(
    @Param("categoryId") categoryId: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: AdminAuthenticatedRequest,
  ) {
    const category = await this.categories.update(categoryId, dto);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: "category.update",
      entityType: "Category",
      entityId: categoryId,
      metadata: { slug: category.slug },
    });
    return category;
  }
}
