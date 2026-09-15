import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches, MaxLength } from "class-validator";

/**
 * The fields that make up a shipping address, shared by:
 * - `CheckoutDto.shippingAddress` (inline, one-off address for this order)
 * - `CreateAddressDto` / `UpdateAddressDto` (persisted, reusable addresses)
 *
 * Kept as one definition so the two call sites can never drift apart on
 * validation rules (see Cycle 3/4 postmortems on duplicated logic).
 */
export class AddressFieldsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  recipientName!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^(\+?98|0)?9\d{9}$/, { message: "شماره موبایل معتبر نیست" })
  phone!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(60)
  province!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(60)
  city!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  addressLine!: string;

  @ApiProperty()
  @IsString()
  @Length(10, 10, { message: "کد پستی باید ۱۰ رقم باشد" })
  @Matches(/^\d{10}$/, { message: "کد پستی باید فقط شامل عدد باشد" })
  postalCode!: string;
}
