import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";
import { MAX_CART_QUANTITY, MIN_CART_QUANTITY } from "../cart-identity.util";

export class UpdateCartItemDto {
  @ApiProperty({ minimum: MIN_CART_QUANTITY, maximum: MAX_CART_QUANTITY })
  @IsInt()
  @Min(MIN_CART_QUANTITY)
  @Max(MAX_CART_QUANTITY)
  quantity!: number;
}
