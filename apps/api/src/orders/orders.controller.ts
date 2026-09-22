import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { OrdersService } from "./orders.service";
import { CartContextService } from "../cart/cart-context.service";
import { SessionService } from "../auth/session/session.service";
import { CheckoutDto } from "./dto/checkout.dto";
import { TrackOrderDto } from "./dto/track-order.dto";
import { CustomerSessionGuard, type AuthenticatedRequest } from "../auth/guards/customer-session.guard";

@ApiTags("orders")
@Controller({ path: "", version: "1" })
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly cartContext: CartContextService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * Checkout supports both guest and authenticated customers, matching
   * the existing Cart architecture (see CartContextService). The
   * customer identity used here is resolved the same way the cart
   * itself was resolved — never trusted from a client-supplied field.
   */
  @Post("checkout")
  @HttpCode(HttpStatus.CREATED)
  async checkout(@Body() dto: CheckoutDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cart = await this.cartContext.resolveCart(req, res);

    const sessionToken = req.cookies?.[this.sessions.cookieName] as string | undefined;
    const session = sessionToken ? await this.sessions.validateAndTouch(sessionToken) : null;
    const customerId = session?.customerId ?? null;

    return this.orders.checkout(cart.id, dto, customerId);
  }

  @UseGuards(CustomerSessionGuard)
  @Get("orders")
  async listMyOrders(@Req() req: AuthenticatedRequest) {
    return this.orders.listForCustomer(req.customerId as string);
  }

  /**
   * Public order tracking — deliberately no auth guard, since a guest
   * checkout has no session to guard with. Safe despite being public
   * because it requires the phone number too, not just the order
   * number — see OrdersService.trackByOrderNumberAndPhone's doc comment
   * for the full reasoning. Also covered by the app-wide rate limiter
   * (AppModule's global ThrottlerGuard), which bounds how many
   * order-number/phone combinations a single client can try.
   */
  @Post("orders/track")
  @HttpCode(HttpStatus.OK)
  async trackOrder(@Body() dto: TrackOrderDto) {
    const order = await this.orders.trackByOrderNumberAndPhone(dto.orderNumber, dto.phone);
    if (!order) {
      // Same message whether the order number doesn't exist or the
      // phone didn't match — see the service method's comment on why
      // that distinction must not be revealed.
      throw new NotFoundException("سفارشی با این مشخصات یافت نشد. شماره سفارش و شماره موبایل را بررسی کنید");
    }
    return order;
  }

  @UseGuards(CustomerSessionGuard)
  @Get("orders/:orderId")
  async getMyOrder(@Param("orderId") orderId: string, @Req() req: AuthenticatedRequest) {
    return this.orders.getForCustomer(orderId, req.customerId as string);
  }

  @UseGuards(CustomerSessionGuard)
  @Post("orders/:orderId/cancel")
  @HttpCode(HttpStatus.OK)
  async cancelOrder(@Param("orderId") orderId: string, @Req() req: AuthenticatedRequest) {
    return this.orders.cancelOrder(orderId, req.customerId as string);
  }

  /**
   * Exercises the PaymentProvider.verify() abstraction for this order's
   * latest payment attempt. Honest by design: manual methods (card-to-
   * card/Sheba) report "not applicable here" (they're confirmed by an
   * admin, not verified through a provider); ONLINE reports a clear
   * "gateway not configured" error rather than a fake result, since no
   * real gateway is connected yet — see IMPLEMENTATION_STATUS.md.
   */
  @UseGuards(CustomerSessionGuard)
  @Post("orders/:orderId/payment/verify")
  @HttpCode(HttpStatus.OK)
  async verifyPayment(@Param("orderId") orderId: string, @Req() req: AuthenticatedRequest) {
    return this.orders.verifyPayment(orderId, req.customerId as string);
  }
}
