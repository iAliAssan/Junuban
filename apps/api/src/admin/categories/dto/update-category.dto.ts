import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { SinglePhotoInputDto } from "../../../common/dto/single-photo-input.dto";

const CATEGORY_STATUS_VALUES = ["ACTIVE", "HIDDEN"] as const;

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: "URL-facing identity. Lowercase ASCII, words joined by single hyphens." })
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
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  iconKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: CATEGORY_STATUS_VALUES })
  @IsOptional()
  @IsIn(CATEGORY_STATUS_VALUES)
  status?: (typeof CATEGORY_STATUS_VALUES)[number];

  @ApiPropertyOptional({
    description: "Omit to leave the photo unchanged; pass null explicitly to remove it; pass an object to set/replace it.",
    type: SinglePhotoInputDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SinglePhotoInputDto)
  photo?: SinglePhotoInputDto | null;
}
