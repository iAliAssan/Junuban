import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

/**
 * One image for the product, keyed by URL rather than an uploaded file.
 * There is no upload/object-storage endpoint yet (see
 * IMPLEMENTATION_STATUS.md Cycle 13 — S3 config exists in
 * `configuration.ts` but no admin upload controller was ever built).
 * Building a real S3 upload flow blind, with no way to exercise it
 * against real credentials in this sandbox, would risk exactly the kind
 * of "looks wired but silently does nothing" gap the master prompt
 * forbids (§26/§34). URL-based media keeps `Media` a first-class
 * relation (never a bare string on Product, per schema comment) while
 * deferring the upload transport itself to a dedicated next cycle with
 * real S3 access to verify against.
 */
export class ProductMediaInputDto {
  @ApiPropertyOptional({ description: "Existing Media row id — include to update/reorder, omit to create." })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url!: string;

  @ApiProperty({ description: "Never empty — enforced here per schema comment on Media.altText." })
  @IsString()
  @MaxLength(300)
  altText!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/** A package-size definition, e.g. "۵۰۰ گرم" / 500g. */
export class WeightOptionInputDto {
  @ApiPropertyOptional({ description: "Existing WeightOption id — include to update, omit to create." })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Display label, e.g. "۵۰۰ گرم"' })
  @IsString()
  @MaxLength(60)
  label!: string;

  @ApiProperty({ description: "Authoritative numeric weight in grams — drives stock consumption, never a per-kg formula." })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  grams!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * One sellable Variant (Product + Producer + Weight), nested under its
 * ProductProducer entry below. `weightOptionId` must reference one of
 * the weight options included in the same request (validated in the
 * service, not here, since cross-field validation against sibling array
 * entries needs the whole payload).
 */
export class VariantInputDto {
  @ApiPropertyOptional({ description: "Existing Variant id — include to update, omit to create." })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: "Must match a weightOptionId from this product's weightOptions array." })
  @IsString()
  weightOptionId!: string;

  @ApiProperty({ description: "Toman, whole-number currency. Never derived from a per-kg rate." })
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  price!: number;

  @ApiProperty({ description: "Unique SKU. Generated server-side if omitted on create." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * One producer supplying this product, with its bulk inventory (grams)
 * and the sellable variants packaged from that producer's lot.
 */
export class ProductProducerInputDto {
  @ApiPropertyOptional({ description: "Existing ProductProducer id — include to update, omit to create." })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsUUID()
  producerId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: "Bulk grams on hand for this producer's lot. Omit to leave inventory unchanged on update." })
  @IsOptional()
  @IsInt()
  @Min(0)
  onHandGrams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThresholdGrams?: number;

  @ApiProperty({ type: [VariantInputDto] })
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  @ArrayMaxSize(20)
  variants!: VariantInputDto[];
}
