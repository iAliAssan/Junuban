import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";

export class VerifyOtpDto {
  @ApiProperty({ example: "09121234567" })
  @IsString()
  @Matches(/^(\+?98|0)?9\d{9}$/, { message: "شماره موبایل معتبر نیست" })
  phone!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Length(6, 6, { message: "کد تایید باید ۶ رقم باشد" })
  @Matches(/^\d{6}$/, { message: "کد تایید باید فقط شامل عدد باشد" })
  code!: string;
}
