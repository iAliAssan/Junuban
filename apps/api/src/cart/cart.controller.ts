import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CartContextService } from "./cart-context.service";
import { CartService } from "./cart.service";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

@ApiTags("cart")
@Controller({ path: "cart", version: "1" })
export class CartController {
  constructor(
    private readonly cartContext: CartContextService,
    private readonly cart: CartService,
  ) {}

  @Get()
  async getCart(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cart = await this.cartContext.resolveCart(req, res);
    return this.cart.getCart(cart.id);
  }

  @Post("items")
  @HttpCode(HttpStatus.OK)
  async addItem(
    @Body() dto: AddCartItemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cart = await this.cartContext.resolveCart(req, res);
    return this.cart.addItem(cart.id, dto);
  }

  @Patch("items/:itemId")
  @HttpCode(HttpStatus.OK)
  async updateItem(
    @Param("itemId") itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cart = await this.cartContext.resolveCart(req, res);
    return this.cart.updateItemQuantity(cart.id, itemId, dto.quantity);
  }

  @Delete("items/:itemId")
  @HttpCode(HttpStatus.OK)
  async removeItem(
    @Param("itemId") itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cart = await this.cartContext.resolveCart(req, res);
    return this.cart.removeItem(cart.id, itemId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async clearCart(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cart = await this.cartContext.resolveCart(req, res);
    return this.cart.clearCart(cart.id);
  }
}
