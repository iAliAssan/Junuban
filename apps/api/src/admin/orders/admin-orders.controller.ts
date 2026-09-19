import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { OrdersService } from "../../orders/orders.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { ListAdminOrdersQueryDto } from "./dto/list-admin-orders.dto";
import { SetOrderStatusDto } from "./dto/set-order-status.dto";
import { AdminSessionGuard, type AdminAuthenticatedRequest } from "../auth/guards/admin-session.guard";

/**
 * Admin-facing order management. Every route here requires a valid
 * admin session — there is no route in this controller reachable by a
 * customer session or by an unauthenticated request. Business logic
 * (status transitions, inventory consumption) lives in the existing
 * `OrdersService`, which this controller merely exposes with the
 * correct authorization boundary; no order logic is duplicated here.
 */
@ApiTags("admin-orders")
@UseGuards(AdminSessionGuard)
@Controller({ path: "admin/orders", version: "1" })
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Get()
  async list(@Query() query: ListAdminOrdersQueryDto) {
    return this.orders.listForAdmin({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
  }

  @Get(":orderId")
  async get(@Param("orderId") orderId: string) {
    return this.orders.getForAdmin(orderId);
  }

  /**
   * Confirms manual payment (card-to-card / Sheba transfer) for an
   * order — this is the concrete Cycle 7 fix for the standing blocker
   * documented in IMPLEMENTATION_STATUS.md: `OrdersService.markOrderPaid`
   * has existed since an earlier cycle but was never reachable from any
   * HTTP route because no trusted (admin-authenticated) caller existed.
   * Every call is recorded in the append-only activity log per master
   * prompt §24 — this is exactly the kind of order-state mutation that
   * must be auditable.
   */
  @Post(":orderId/mark-paid")
  @HttpCode(HttpStatus.OK)
  async markPaid(@Param("orderId") orderId: string, @Req() req: AdminAuthenticatedRequest) {
    const order = await this.orders.markOrderPaid(orderId, req.adminId);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: "order.mark_paid",
      entityType: "Order",
      entityId: orderId,
      metadata: { orderNumber: order.orderNumber },
    });
    return order;
  }

  /**
   * Advances an order through fulfillment (PROCESSING/SHIPPED/DELIVERED)
   * or cancels/refunds it. See SetOrderStatusDto for why PAID isn't
   * settable through this route. `OrdersService.adminSetStatus` validates
   * the transition against the same state graph the rest of the order
   * lifecycle uses and restocks inventory automatically when cancelling
   * or refunding an already-paid order.
   */
  @Post(":orderId/status")
  @HttpCode(HttpStatus.OK)
  async setStatus(
    @Param("orderId") orderId: string,
    @Body() dto: SetOrderStatusDto,
    @Req() req: AdminAuthenticatedRequest,
  ) {
    const order = await this.orders.adminSetStatus(orderId, dto.status, req.adminId as string, dto.note);
    await this.activityLog.record({
      adminId: req.adminId as string,
      action: "order.set_status",
      entityType: "Order",
      entityId: orderId,
      metadata: { orderNumber: order.orderNumber, status: dto.status },
    });
    return order;
  }
}
