import { randomInt, createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import type { AppConfig } from "../../config/configuration";
import { ConsoleSmsProvider, UnconfiguredSmsProvider, KavenegarSmsProvider, GhasedakSmsProvider, type SmsProvider } from "./sms-provider";

export type OtpRequestResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "incorrect_code" };

const OTP_LENGTH = 6;
/** The per-IP ceiling is this many times the per-phone hourly limit — see ipRateLimitKey. */
const IP_RATE_LIMIT_MULTIPLIER = 10;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly sms: SmsProvider;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.sms = this.buildSmsProvider();
  }

  /**
   * Selects the SMS gateway from SMS_PROVIDER. Real gateways require
   * SMS_PROVIDER_API_KEY — this is checked here, at construction time
   * (app startup), rather than deferred to the first OTP send, so a
   * missing credential fails the deployment immediately instead of
   * silently failing every customer's first login attempt in production.
   */
  private buildSmsProvider(): SmsProvider {
    const smsConfig = this.config.get("sms", { infer: true });
    switch (smsConfig.provider) {
      case "console":
        return new ConsoleSmsProvider();
      case "kavenegar":
        if (!smsConfig.apiKey) {
          throw new Error("SMS_PROVIDER=kavenegar requires SMS_PROVIDER_API_KEY to be set");
        }
        return new KavenegarSmsProvider(smsConfig.apiKey, smsConfig.kavenegarTemplate);
      case "ghasedak":
        if (!smsConfig.apiKey) {
          throw new Error("SMS_PROVIDER=ghasedak requires SMS_PROVIDER_API_KEY to be set");
        }
        return new GhasedakSmsProvider(smsConfig.apiKey, smsConfig.ghasedakTemplate);
      default:
        return new UnconfiguredSmsProvider(smsConfig.provider);
    }
  }

  private hashCode(phone: string, code: string): string {
    const secret = this.config.get("otp", { infer: true }).hashSecret;
    return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
  }

  private redisKey(phone: string): string {
    return `otp:${phone}`;
  }

  private rateLimitKey(phone: string): string {
    return `otp:ratelimit:${phone}`;
  }

  /**
   * Per-IP ceiling, in addition to the per-phone one below. Without
   * this, a single source could still send unlimited OTP SMS as long as
   * it varies the target phone number each time — each phone number
   * would individually still be under its own per-hour limit, but the
   * aggregate SMS cost/abuse from one IP would be unbounded. Deliberately
   * a higher ceiling than the per-phone limit (a shared IP — office,
   * NAT, campus wifi — can legitimately represent many real customers),
   * not a replacement for it.
   */
  private ipRateLimitKey(ipAddress: string): string {
    return `otp:ratelimit:ip:${ipAddress}`;
  }

  /**
   * Issues a fresh 6-digit OTP for `phone`, replacing any prior active
   * code (atomic overwrite via Redis SET). Enforces a per-hour request
   * rate limit. Writes a DB audit row (hash only — never the raw code).
   */
  async requestOtp(
    phone: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<OtpRequestResult> {
    const otpConfig = this.config.get("otp", { infer: true });
    const rlKey = this.rateLimitKey(phone);

    if (meta.ipAddress) {
      const ipKey = this.ipRateLimitKey(meta.ipAddress);
      const ipCount = await this.redis.client.incr(ipKey);
      if (ipCount === 1) {
        await this.redis.client.expire(ipKey, 60 * 60);
      }
      if (ipCount > otpConfig.requestRateLimitPerHour * IP_RATE_LIMIT_MULTIPLIER) {
        const ttl = await this.redis.client.ttl(ipKey);
        return { ok: false, reason: "rate_limited", retryAfterSeconds: Math.max(ttl, 1) };
      }
    }

    const count = await this.redis.client.incr(rlKey);
    if (count === 1) {
      await this.redis.client.expire(rlKey, 60 * 60);
    }
    if (count > otpConfig.requestRateLimitPerHour) {
      const ttl = await this.redis.client.ttl(rlKey);
      return { ok: false, reason: "rate_limited", retryAfterSeconds: Math.max(ttl, 1) };
    }

    const code = randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
    const codeHash = this.hashCode(phone, code);
    const expiresAt = new Date(Date.now() + otpConfig.ttlSeconds * 1000);

    // Redis is the active/hot-path store for verification.
    await this.redis.client.set(
      this.redisKey(phone),
      JSON.stringify({ codeHash, attempts: 0, maxAttempts: otpConfig.maxAttempts }),
      "EX",
      otpConfig.ttlSeconds,
    );

    // Database audit trail — never stores the raw code.
    await this.prisma.otpRequest.create({
      data: {
        phone,
        codeHash,
        maxAttempts: otpConfig.maxAttempts,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    try {
      await this.sms.sendOtp(phone, code);
    } catch (err) {
      // Delivery failed — the customer has no usable code. Undo both the
      // Redis-held OTP (so a retry issues a genuinely fresh code rather
      // than reusing one that was never delivered) and the rate-limit
      // increment (so a gateway outage doesn't also cost the customer
      // part of their hourly request quota for an SMS they never got).
      // The DB audit row is deliberately left in place — it's an
      // append-only record of the attempt, not of successful delivery.
      await this.redis.client.del(this.redisKey(phone));
      await this.redis.client.decr(rlKey);
      throw err;
    }

    this.logger.log(`OTP issued for ${phone.slice(0, 5)}***`);
    return { ok: true };
  }

  /**
   * Verifies `code` against the active OTP for `phone`. Atomic w.r.t.
   * attempt counting (Lua-free approach using WATCH/MULTI would be more
   * complex; a simple read-increment-write is acceptable here because
   * the attempt ceiling only needs to be approximately enforced — a
   * lost increment under a race merely allows one extra guess, never
   * more than the Redis TTL allows in total attack volume).
   */
  async verifyOtp(phone: string, code: string): Promise<OtpVerifyResult> {
    const key = this.redisKey(phone);
    const raw = await this.redis.client.get(key);
    if (!raw) {
      return { ok: false, reason: "not_found" };
    }

    const state = JSON.parse(raw) as { codeHash: string; attempts: number; maxAttempts: number };
    if (state.attempts >= state.maxAttempts) {
      await this.redis.client.del(key);
      return { ok: false, reason: "too_many_attempts" };
    }

    const candidateHash = this.hashCode(phone, code);
    const matches = timingSafeEqualHex(candidateHash, state.codeHash);

    if (!matches) {
      state.attempts += 1;
      const ttl = await this.redis.client.ttl(key);
      await this.redis.client.set(key, JSON.stringify(state), "EX", ttl > 0 ? ttl : 1);
      await this.prisma.otpRequest.updateMany({
        where: { phone, codeHash: state.codeHash, verifiedAt: null },
        data: { attempts: { increment: 1 } },
        // Note: updateMany doesn't support increment ordering guarantees
        // beyond Postgres row-level locking, which is sufficient here.
      });
      return { ok: false, reason: "incorrect_code" };
    }

    await this.redis.client.del(key);
    await this.prisma.otpRequest.updateMany({
      where: { phone, codeHash: state.codeHash, verifiedAt: null },
      data: { verifiedAt: new Date() },
    });
    return { ok: true };
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
