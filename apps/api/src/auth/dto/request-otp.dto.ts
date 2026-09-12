import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class RequestOtpDto {
  @ApiProperty({ example: "09121234567", description: "Iranian mobile number, any common format" })
  @IsString()
  @Matches(/^(\+?98|0)?9\d{9}$/, { message: "شماره موبایل معتبر نیست" })
  phone!: string;
}
