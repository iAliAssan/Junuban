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
import { PrismaService } from "../prisma/prisma.service";
import { OtpService } from "./otp/otp.service";
import { SessionService } from "./session/session.service";
import { normalizeIranianMobile } from "./otp/phone.util";
import { SmsDeliveryError } from "./otp/sms-provider";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { CustomerSessionGuard, type AuthenticatedRequest } from "./guards/customer-session.guard";
import { CartService } from "../cart/cart.service";
import { CartContextService } from "../cart/cart-context.service";
import { clearSessionCookieOptions, sessionCookieOptions } from "../common/cookies/cookie-options.util";

@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly cartContext: CartContextService,
  ) {}

  @Post("otp/request")
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    const phone = normalizeIranianMobile(dto.phone);
    if (!phone) {
      throw new UnauthorizedException("شماره موبایل معتبر نیست");
    }

    let result;
    try {
      result = await this.otp.requestOtp(phone, {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch (err) {
      // A gateway-level delivery failure (network error, bad credentials,
      // provider-reported failure) is distinct from an unexpected bug —
      // surface it as a clear, actionable 502 rather than letting it fall
      // through to the generic "Internal server error" the global filter
      // returns for everything else. The underlying cause is still logged
      // server-side by that same filter; nothing sensitive is added here.
      if (err instanceof SmsDeliveryError) {
        throw new HttpException(
          "ارسال پیامک با خطا مواجه شد. لطفاً چند لحظه دیگر دوباره تلاش کنید",
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw err;
    }

    if (!result.ok) {
      throw new HttpException(
        `درخواست بیش از حد مجاز. لطفاً ${result.retryAfterSeconds} ثانیه دیگر دوباره تلاش کنید`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return { sent: true };
  }

  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const phone = normalizeIranianMobile(dto.phone);
    if (!phone) {
      throw new UnauthorizedException("شماره موبایل معتبر نیست");
    }

    const result = await this.otp.verifyOtp(phone, dto.code);
    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        not_found: "کد تایید یافت نشد یا منقضی شده است",
        expired: "کد تایید منقضی شده است",
        too_many_attempts: "تعداد تلاش‌های مجاز به پایان رسیده است",
        incorrect_code: "کد تایید نادرست است",
      };
      throw new UnauthorizedException(messages[result.reason]);
    }

    // First successful OTP verification for a phone number creates the account.
    const customer = await this.prisma.customer.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    const { token } = await this.sessions.createSession(customer.id, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.cookie(this.sessions.cookieName, token, sessionCookieOptions(this.sessions.cookieMaxAgeMs));

    // If this browser had a guest cart, merge it into the now-authenticated
    // customer's cart (packaging-distinct lines stay distinct, quantities
    // are summed and re-clamped to 1–99 — see CartService.mergeGuestCartOnLogin).
    const guestCartToken = req.cookies?.[this.cartContext.guestCookieName] as string | undefined;
    if (guestCartToken) {
      await this.cart.mergeGuestCartOnLogin(guestCartToken, customer.id);
      res.clearCookie(this.cartContext.guestCookieName, clearSessionCookieOptions());
    }

    return {
      customer: { id: customer.id, phone: customer.phone, fullName: customer.fullName },
    };
  }

  @UseGuards(CustomerSessionGuard)
  @Get("me")
  async me(@Req() req: AuthenticatedRequest) {
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: req.customerId },
      select: { id: true, phone: true, fullName: true, email: true, createdAt: true },
    });
    return { customer };
  }

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
