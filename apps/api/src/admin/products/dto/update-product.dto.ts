import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { ProductMediaInputDto, ProductProducerInputDto, WeightOptionInputDto } from "./product-nested.dto";

const PRODUCT_TYPE_VALUES = ["SIMPLE", "BUNDLE"] as const;
const PRODUCT_STATUS_VALUES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

/**
 * Every field optional (a real partial-update DTO, not CreateProductDto
 * re-used with looser typing) — an admin editing just the description
 * must not be forced to resend producers/variants/weightOptions they
 * didn't touch. When `weightOptions`/`producers` ARE sent, the service
 * treats each array as the complete replacement set for that relation
 * (entries with `id` are updated, entries without are created, and any
 * existing row not present in the array is removed) — documented on
 * AdminProductsService.update itself.
 */
export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "شناسه (slug) باید فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد",
  })
  @MaxLength(160)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: PRODUCT_TYPE_VALUES })
  @IsOptional()
  @IsIn(PRODUCT_TYPE_VALUES)
  type?: (typeof PRODUCT_TYPE_VALUES)[number];

  @ApiPropertyOptional({ enum: PRODUCT_STATUS_VALUES })
  @IsOptional()
  @IsIn(PRODUCT_STATUS_VALUES)
  status?: (typeof PRODUCT_STATUS_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  harvestSeason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  metaDescription?: string;

  @ApiPropertyOptional({ type: [WeightOptionInputDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WeightOptionInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  weightOptions?: WeightOptionInputDto[];

  @ApiPropertyOptional({ type: [ProductProducerInputDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductProducerInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  producers?: ProductProducerInputDto[];

  @ApiPropertyOptional({ type: [ProductMediaInputDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductMediaInputDto)
  @ArrayMaxSize(20)
  media?: ProductMediaInputDto[];
}
