import { ApiProperty } from "@nestjs/swagger";
import { IsUrl, IsString, MaxLength } from "class-validator";

/**
 * Shared shape for any single-photo (1:1 Media relation — e.g.
 * Producer.photo, Category.photo, both `Media?` with a `@unique`
 * foreign key) admin input. Intentionally simpler than
 * ProductMediaInputDto (no id/sortOrder to reconcile against an
 * existing array, since there's only ever zero or one row) but kept
 * validation-identical to it (@IsUrl, altText max length) since both
 * ultimately populate the same Media table.
 */
export class SinglePhotoInputDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url!: string;

  @ApiProperty({ description: "Never empty — enforced here per schema comment on Media.altText." })
  @IsString()
  @MaxLength(300)
  altText!: string;
}
