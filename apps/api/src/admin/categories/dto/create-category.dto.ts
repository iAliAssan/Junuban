import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { SinglePhotoInputDto } from "../../../common/dto/single-photo-input.dto";

const CATEGORY_STATUS_VALUES = ["ACTIVE", "HIDDEN"] as const;

export class CreateCategoryDto {
  @ApiProperty({ description: "URL-facing identity. Lowercase ASCII, words joined by single hyphens." })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "شناسه (slug) باید فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد",
  })
  @MaxLength(160)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: "Icon identifier used by the storefront, e.g. an icon-sprite key." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  iconKey?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: CATEGORY_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(CATEGORY_STATUS_VALUES)
  status?: (typeof CATEGORY_STATUS_VALUES)[number];

  @ApiPropertyOptional({
    description:
      "Category's display photo (one Media row, Category.photo — a unique 1:1 relation). Omit this field entirely to leave the photo unset; pass null explicitly to remove it (see update DTO).",
    type: SinglePhotoInputDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SinglePhotoInputDto)
  photo?: SinglePhotoInputDto | null;
}
