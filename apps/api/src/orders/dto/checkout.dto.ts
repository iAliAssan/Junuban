import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { CHECKOUT_AVAILABLE_PAYMENT_METHODS, type SupportedPaymentMethod } from "../payment/payment-provider.factory";

export class ShippingAddressDto {
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

export class CheckoutDto {
  @ApiProperty({ type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

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
