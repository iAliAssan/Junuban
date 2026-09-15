import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { AdminAuthController } from "./auth/admin-auth.controller";
import { AdminAuthService } from "./auth/admin-auth.service";
import { AdminSessionService } from "./auth/session/admin-session.service";
import { AdminSessionGuard } from "./auth/guards/admin-session.guard";
import { AdminOwnerGuard } from "./auth/guards/admin-owner.guard";
import { AdminOrdersController } from "./orders/admin-orders.controller";
import { ActivityLogService } from "./activity-log/activity-log.service";
import { ActivityLogController } from "./activity-log/activity-log.controller";

/**
 * Back-office admin module — entirely separate auth/authorization
 * surface from the customer-facing app (see master prompt §6).
 * Currently covers: admin login/session (email + Argon2id), order
 * management (list/view/mark-paid), and the owner-only activity log.
 * Intended to grow (products, pricing, inventory, discounts, reviews,
 * media, content, team, settings — see master prompt §24) in later
 * cycles; this module and its guards are the foundation those build on.
 */
@Module({
  imports: [OrdersModule],
  controllers: [AdminAuthController, AdminOrdersController, ActivityLogController],
  providers: [AdminAuthService, AdminSessionService, AdminSessionGuard, AdminOwnerGuard, ActivityLogService],
  exports: [AdminSessionService, AdminSessionGuard, AdminOwnerGuard, ActivityLogService],
})
export class AdminModule {}
