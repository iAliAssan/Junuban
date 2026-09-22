import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class AdminLoginDto {
  @ApiProperty({ example: "owner@junuban.dev" })
  @IsEmail({}, { message: "ایمیل معتبر نیست" })
  email!: string;

  @ApiProperty({ example: "ChangeMe123!" })
  @IsString()
  @MinLength(8, { message: "رمز عبور باید حداقل ۸ کاراکتر باشد" })
  password!: string;
}
