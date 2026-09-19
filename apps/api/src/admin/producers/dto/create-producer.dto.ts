import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ProducerPhotoInputDto } from "./producer-photo-input.dto";

const PRODUCER_STATUS_VALUES = ["ACTIVE", "HIDDEN"] as const;

export class CreateProducerDto {
  @ApiProperty({ description: "URL-facing identity. Lowercase ASCII, words joined by single hyphens." })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "شناسه (slug) باید فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد",
  })
  @MaxLength(160)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string;

  @ApiProperty({ description: 'e.g. "میناب، هرمزگان"' })
  @IsString()
  @MaxLength(160)
  region!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  province!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({ enum: PRODUCER_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(PRODUCER_STATUS_VALUES)
  status?: (typeof PRODUCER_STATUS_VALUES)[number];

  @ApiPropertyOptional({
    description:
      "Producer's profile photo (one Media row, Producer.photo — a unique 1:1 relation, not an array like " +
      "product images). Omit this field entirely to leave the photo unchanged; pass null explicitly to remove it.",
    type: ProducerPhotoInputDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProducerPhotoInputDto)
  photo?: ProducerPhotoInputDto | null;
}
