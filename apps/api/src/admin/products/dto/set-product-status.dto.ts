import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

// Deliberately excludes ARCHIVED — archiving is set via the general
// update path (AdminProductsService.update), not this toggle. See
// AdminProductsService.setStatus for the ARCHIVED-is-terminal rule.
const TOGGLEABLE_STATUS_VALUES = ["ACTIVE", "DRAFT"] as const;

export class SetProductStatusDto {
  @ApiProperty({ enum: TOGGLEABLE_STATUS_VALUES })
  @IsIn(TOGGLEABLE_STATUS_VALUES)
  status!: (typeof TOGGLEABLE_STATUS_VALUES)[number];
}
