import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

// Mirrors the `ProductStatus` enum in schema.prisma exactly — kept as a
// literal tuple here (same pattern as ListAdminOrdersQueryDto's
// ORDER_STATUS_VALUES) so `class-validator`'s `@IsIn` gives a real,
// readable 400 instead of a Prisma-level enum-cast failure if an admin
// UI ever sends a stale/typo'd value.
const PRODUCT_STATUS_VALUES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

export class ListAdminProductsQueryDto {
  @ApiPropertyOptional({ description: "Free-text search across product name/slug" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: PRODUCT_STATUS_VALUES })
  @IsOptional()
  @IsIn(PRODUCT_STATUS_VALUES)
  status?: (typeof PRODUCT_STATUS_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
