import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Matches, ValidateNested } from "class-validator";
import { CHECKOUT_AVAILABLE_PAYMENT_METHODS, type SupportedPaymentMethod } from "../payment/payment-provider.factory";
import { AddressFieldsDto } from "../../addresses/dto/address-fields.dto";

// Re-exported for backward compatibility — some earlier code/tests import
// ShippingAddressDto from this module. The fields now live in the shared
// apps/api/src/addresses/dto/address-fields.dto.ts so the Address module
// and checkout's inline-address path can never validate differently.
export { AddressFieldsDto as ShippingAddressDto };

export class CheckoutDto {
  @ApiPropertyOptional({
    type: AddressFieldsDto,
    description: "A one-off address for this order only. Provide this OR addressId, not neither.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressFieldsDto)
  shippingAddress?: AddressFieldsDto;

  @ApiPropertyOptional({
    description: "An existing, owned saved address to ship to. Provide this OR shippingAddress, not neither. Only valid for authenticated customers.",
  })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiProperty({ enum: CHECKOUT_AVAILABLE_PAYMENT_METHODS })
  @IsIn(CHECKOUT_AVAILABLE_PAYMENT_METHODS, {
    message: "روش پرداخت انتخابی در حال حاضر پشتیبانی نمی‌شود",
  })
  paymentMethod!: SupportedPaymentMethod;

  @ApiPropertyOptional({ description: "Required only for guest checkout (no active customer session)" })
  @IsOptional()
  @IsString()
  @Matches(/^(\+?98|0)?9\d{9}$/, { message: "شماره موبایل معتبر نیست" })
  guestPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: "ایمیل معتبر نیست" })
  guestEmail?: string;

  @ApiProperty({
    description:
      "Client-generated UUID, stable across retries of the same checkout attempt — prevents duplicate orders from double-taps or network retries.",
  })
  @IsUUID()
  idempotencyKey!: string;
}
