import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { SinglePhotoInputDto } from "../../../common/dto/single-photo-input.dto";

const PRODUCER_STATUS_VALUES = ["ACTIVE", "HIDDEN"] as const;

export class UpdateProducerDto {
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
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string;

  @ApiPropertyOptional({ description: 'e.g. "میناب، هرمزگان"' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({ enum: PRODUCER_STATUS_VALUES })
  @IsOptional()
  @IsIn(PRODUCER_STATUS_VALUES)
  status?: (typeof PRODUCER_STATUS_VALUES)[number];

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
