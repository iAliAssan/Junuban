import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminProductsService } from "./admin-products.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { ListAdminProductsQueryDto } from "./dto/list-admin-products.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { SetProductStatusDto } from "./dto/set-product-status.dto";
import { AdminSessionGuard, type AdminAuthenticatedRequest } from "../auth/guards/admin-session.guard";

/**
 * Admin product-catalog management (master prompt §17, Cycle 13).
 * Every route requires a valid admin session — same authorization
 * boundary as AdminOrdersController, no route reachable without it.
 * Mutations are recorded in the append-only activity log (§24), same
 * one-call-site pattern AdminOrdersController established for
 * `mark-paid`. Business/validation logic lives entirely in
 * AdminProductsService; this controller only maps HTTP verbs to it and
 * writes the audit entry.
 */
@ApiTags("admin-products")
@UseGuards(AdminSessionGuard)
@Controller({ path: "admin/products", version: "1" })
export class AdminProductsController {
  constructor(
    private readonly products: AdminProductsService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Category/producer options for the create/edit form. Registered
   * before ":productId" so Nest's route matching never treats the
   * literal segment "form-options" as a productId path param.
   */
  @Get("form-options")
  listFormOptions() {
    return this.products.listFormOptions();
  }

  @Get()
  list(@Query() query: ListAdminProductsQueryDto) {
    return this.products.list(query);
  }

  @Get(":productId")
  get(@Param("productId") productId: string) {
    return this.products.getById(productId);
  }

  @Post()
  async create(@Body() dto: CreateProductDto, @Req() req: AdminAuthenticatedRequest) {
    const product = await this.products.create(dto);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: "product.create",
      entityType: "Product",
      entityId: product.id,
      metadata: { slug: product.slug, name: product.name },
    });
    return product;
  }

  @Patch(":productId")
  async update(
    @Param("productId") productId: string,
    @Body() dto: UpdateProductDto,
    @Req() req: AdminAuthenticatedRequest,
  ) {
    const product = await this.products.update(productId, dto);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: "product.update",
      entityType: "Product",
      entityId: productId,
      metadata: { slug: product.slug },
    });
    return product;
  }

  /**
   * Dedicated publish/unpublish action, separate from the general
   * `update` — a distinctly meaningful, distinctly logged mutation per
   * master prompt Cycle 13 ("Publish/unpublish controls" listed
   * alongside, not folded into, the edit form).
   */
  @Patch(":productId/status")
  @HttpCode(HttpStatus.OK)
  async setStatus(
    @Param("productId") productId: string,
    @Body() dto: SetProductStatusDto,
    @Req() req: AdminAuthenticatedRequest,
  ) {
    const product = await this.products.setStatus(productId, dto.status);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: dto.status === "ACTIVE" ? "product.publish" : "product.unpublish",
      entityType: "Product",
      entityId: productId,
      metadata: { slug: product.slug },
    });
    return this.products.getById(productId);
  }
}
