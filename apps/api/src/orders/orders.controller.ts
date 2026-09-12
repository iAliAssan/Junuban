import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { OrdersService } from "./orders.service";
import { CartContextService } from "../cart/cart-context.service";
import { SessionService } from "../auth/session/session.service";
import { CheckoutDto } from "./dto/checkout.dto";
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
}
