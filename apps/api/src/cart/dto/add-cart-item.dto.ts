import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { MAX_CART_QUANTITY, MIN_CART_QUANTITY } from "../cart-identity.util";

export class AddCartItemDto {
  @ApiProperty({ description: "The specific Product+Producer+Weight variant being added" })
  @IsUUID()
  variantId!: string;

  @ApiPropertyOptional({ description: "Optional packaging choice; omit for no special packaging" })
  @IsOptional()
  @IsUUID()
  packagingOptionId?: string;

  @ApiPropertyOptional({ default: 1, minimum: MIN_CART_QUANTITY, maximum: MAX_CART_QUANTITY })
  @IsOptional()
  @IsInt()
  @Min(MIN_CART_QUANTITY)
  @Max(MAX_CART_QUANTITY)
  quantity: number = 1;
}
