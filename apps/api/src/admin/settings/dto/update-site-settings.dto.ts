import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { SinglePhotoInputDto } from "../../../common/dto/single-photo-input.dto";

/**
 * Scoped to the payment/card settings this cycle adds admin UI for
 * (see PaymentProviderFactory, which now reads these instead of
 * CARD_TO_CARD_NUMBER/SHEBA_IBAN env vars). SiteSettings has other
 * fields (store name, shipping rate, homepage promo, trust stats) with
 * no admin UI yet — deliberately left out of this DTO rather than
 * exposed half-built; extend this DTO when those get their own admin
 * screens.
 */
export class UpdateSiteSettingsDto {
  @ApiPropertyOptional({ description: "Card number for card-to-card transfers. Digits only, spaces stripped by the client." })
  @IsOptional()
  @IsString()
  @Matches(/^\d{16,19}$/, { message: "شماره کارت باید بین ۱۶ تا ۱۹ رقم باشد" })
  cardToCardNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cardToCardHolderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cardToCardBankName?: string;

  @ApiPropertyOptional({ description: "IBAN/Sheba number, e.g. IR820540102680020817909002." })
  @IsOptional()
  @IsString()
  @Matches(/^IR\d{24}$/, { message: "شماره شبا معتبر نیست (باید با IR شروع شود و ۲۴ رقم داشته باشد)" })
  shebaIban?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shebaHolderName?: string;

  @ApiPropertyOptional({ description: "Free-text instructions shown alongside payment info, e.g. how/when to send a payment receipt." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  paymentInstructions?: string;

  @ApiPropertyOptional({
    description: "Card image (one Media row). Omit to leave unchanged; pass null to remove; pass an object to set/replace.",
    type: SinglePhotoInputDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SinglePhotoInputDto)
  paymentCardPhoto?: SinglePhotoInputDto | null;
}
