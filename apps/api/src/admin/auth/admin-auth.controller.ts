import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AdminAuthService } from "./admin-auth.service";
import { AdminSessionService } from "./session/admin-session.service";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { AdminSessionGuard, type AdminAuthenticatedRequest } from "./guards/admin-session.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { clearSessionCookieOptions, sessionCookieOptions } from "../../common/cookies/cookie-options.util";

@ApiTags("admin-auth")
@Controller({ path: "admin/auth", version: "1" })
export class AdminAuthController {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly sessions: AdminSessionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: AdminLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.adminAuth.login(dto.email, dto.password);

    if (!result.ok) {
      if (result.reason === "rate_limited") {
        throw new HttpException(
          `تعداد تلاش برای ورود بیش از حد مجاز است. لطفاً ${result.retryAfterSeconds} ثانیه دیگر دوباره تلاش کنید`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (result.reason === "disabled") {
        throw new UnauthorizedException("دسترسی این حساب غیرفعال شده است");
      }
      throw new UnauthorizedException("ایمیل یا رمز عبور نادرست است");
    }

    const { token } = await this.sessions.createSession(result.admin.id, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.cookie(this.sessions.cookieName, token, sessionCookieOptions(this.sessions.cookieMaxAgeMs));

    return {
      admin: {
        id: result.admin.id,
        email: result.admin.email,
        fullName: result.admin.fullName,
        role: result.admin.role,
      },
    };
  }

  @UseGuards(AdminSessionGuard)
  @Get("me")
  async me(@Req() req: AdminAuthenticatedRequest) {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: req.adminId },
      select: { id: true, email: true, fullName: true, role: true, lastLoginAt: true },
    });
    return { admin };
  }

  @UseGuards(AdminSessionGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[this.sessions.cookieName];
    if (token) {
      await this.sessions.revoke(token);
    }
    res.clearCookie(this.sessions.cookieName, clearSessionCookieOptions());
    return { loggedOut: true };
  }
}
