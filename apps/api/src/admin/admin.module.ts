import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { AdminAuthController } from "./auth/admin-auth.controller";
import { AdminAuthService } from "./auth/admin-auth.service";
import { AdminSessionService } from "./auth/session/admin-session.service";
import { AdminSessionGuard } from "./auth/guards/admin-session.guard";
import { AdminOwnerGuard } from "./auth/guards/admin-owner.guard";
import { AdminOrdersController } from "./orders/admin-orders.controller";
import { AdminProductsController } from "./products/admin-products.controller";
import { AdminProductsService } from "./products/admin-products.service";
import { AdminCategoriesController } from "./categories/admin-categories.controller";
import { AdminCategoriesService } from "./categories/admin-categories.service";
import { AdminProducersController } from "./producers/admin-producers.controller";
import { AdminProducersService } from "./producers/admin-producers.service";
import { AdminPackagingOptionsController } from "./packaging-options/admin-packaging-options.controller";
import { AdminPackagingOptionsService } from "./packaging-options/admin-packaging-options.service";
import { ActivityLogService } from "./activity-log/activity-log.service";
import { ActivityLogController } from "./activity-log/activity-log.controller";

/**
 * Back-office admin module — entirely separate auth/authorization
 * surface from the customer-facing app (see master prompt §6).
 * Currently covers: admin login/session (email + Argon2id), order
 * management (list/view/mark-paid/status transitions), product-catalog
 * management (list/create/edit/publish, with nested
 * producers/weight-options/variants/inventory/media), category,
 * producer, and packaging-option reference-data management (the
 * dropdowns/pickers product creation and checkout depend on), and the
 * owner-only activity log. Intended to grow further (discounts,
 * reviews, content, team, settings — see master prompt §24) in later
 * cycles; this module and its guards are the foundation those build on.
 */
@Module({
  imports: [OrdersModule],
  controllers: [
    AdminAuthController,
    AdminOrdersController,
    AdminProductsController,
    AdminCategoriesController,
    AdminProducersController,
    AdminPackagingOptionsController,
    ActivityLogController,
  ],
  providers: [
    AdminAuthService,
    AdminSessionService,
    AdminSessionGuard,
    AdminOwnerGuard,
    AdminProductsService,
    AdminCategoriesService,
    AdminProducersService,
    AdminPackagingOptionsService,
    ActivityLogService,
  ],
  exports: [AdminSessionService, AdminSessionGuard, AdminOwnerGuard, ActivityLogService],
})
export class AdminModule {}
