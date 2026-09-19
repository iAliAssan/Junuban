import { ApiProperty } from "@nestjs/swagger";
import { IsUrl, IsString, MaxLength } from "class-validator";

/**
 * Producer.photo is a single optional Media row (1:1, Media.producerId
 * is @unique) — not an array like Product.images — so this is
 * intentionally simpler than ProductMediaInputDto (no id/sortOrder to
 * reconcile against an existing array). Validation rules themselves
 * (@IsUrl, altText max length) are kept identical to
 * ProductMediaInputDto on purpose, since both ultimately populate the
 * same Media table.
 */
export class ProducerPhotoInputDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url!: string;

  @ApiProperty({ description: "Never empty — enforced here per schema comment on Media.altText." })
  @IsString()
  @MaxLength(300)
  altText!: string;
}
