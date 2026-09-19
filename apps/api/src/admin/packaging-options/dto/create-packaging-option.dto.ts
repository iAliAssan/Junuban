import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreatePackagingOptionDto {
  @ApiProperty({ description: 'e.g. "بسته‌بندی استاندارد", "جعبه هدیه"' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: "Toman, added to line price. 0 for the default/free option.", default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  priceDelta?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
