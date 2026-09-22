import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class TrackOrderDto {
  @ApiProperty({ example: "AU-GXM14L7" })
  @IsString()
  @Matches(/^AU-[0-9A-Z]{7}$/, { message: "شماره سفارش معتبر نیست" })
  orderNumber!: string;

  @ApiProperty({ description: "The phone number used when the order was placed." })
  @IsString()
  @Matches(/^(\+?98|0)?9\d{9}$/, { message: "شماره موبایل معتبر نیست" })
  phone!: string;
}
