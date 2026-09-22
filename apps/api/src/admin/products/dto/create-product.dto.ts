import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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

export class CreateProductDto {
  @ApiProperty({ description: "URL-facing identity. Lowercase ASCII, words joined by single hyphens." })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "شناسه (slug) باید فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد",
  })
  @MaxLength(160)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ enum: PRODUCT_TYPE_VALUES, default: "SIMPLE" })
  @IsOptional()
  @IsIn(PRODUCT_TYPE_VALUES)
  type?: (typeof PRODUCT_TYPE_VALUES)[number];

  @ApiPropertyOptional({
    enum: PRODUCT_STATUS_VALUES,
    default: "DRAFT",
    description: "New products default to DRAFT regardless of what is sent — see AdminProductsService for why.",
  })
  @IsOptional()
  @IsIn(PRODUCT_STATUS_VALUES)
  status?: (typeof PRODUCT_STATUS_VALUES)[number];

  @ApiPropertyOptional({ description: 'e.g. "برداشت پاییز ۱۴۰۳"' })
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

  @ApiProperty({ type: [WeightOptionInputDto], description: "At least one weight option is required to sell anything." })
  @ValidateNested({ each: true })
  @Type(() => WeightOptionInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  weightOptions!: WeightOptionInputDto[];

  @ApiProperty({ type: [ProductProducerInputDto], description: "At least one producer link is required to sell anything." })
  @ValidateNested({ each: true })
  @Type(() => ProductProducerInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  producers!: ProductProducerInputDto[];

  @ApiPropertyOptional({ type: [ProductMediaInputDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductMediaInputDto)
  @ArrayMaxSize(20)
  media?: ProductMediaInputDto[];
}
