import { Injectable, Logger } from "@nestjs/common";
import { verify } from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import type { AdminUser } from "@prisma/client";

export type AdminLoginResult =
  | { ok: true; admin: AdminUser }
  | { ok: false; reason: "invalid_credentials" | "disabled" | "rate_limited"; retryAfterSeconds?: number };

const MAX_ATTEMPTS_PER_WINDOW = 10;
const WINDOW_SECONDS = 15 * 60;

/**
 * Admin login business logic. Kept separate from AdminAuthController so
 * the rate-limiting/verification rules are unit-testable without an
 * HTTP layer, matching the project's existing pattern (see OtpService /
 * CartService).
 */
@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private rateLimitKey(email: string): string {
    return `admin:login:ratelimit:${email.toLowerCase()}`;
  }

  /**
   * Verifies email + password against Argon2id hash. Rate-limited per
   * email (not per IP alone) to slow credential-stuffing against a
   * known admin address, mirroring the OTP request-rate-limit pattern
   * already used for customer auth. Always performs the same amount of
   * work on the "user not found" path as on the "wrong password" path
   * (a dummy hash is verified) to avoid leaking account existence via
   * response timing.
   */
  async login(email: string, password: string): Promise<AdminLoginResult> {
    const rlKey = this.rateLimitKey(email);
    const attempts = await this.redis.client.incr(rlKey);
    if (attempts === 1) {
      await this.redis.client.expire(rlKey, WINDOW_SECONDS);
    }
    if (attempts > MAX_ATTEMPTS_PER_WINDOW) {
      const ttl = await this.redis.client.ttl(rlKey);
      return { ok: false, reason: "rate_limited", retryAfterSeconds: Math.max(ttl, 1) };
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });

    // Constant-shape credential check: verify against a real hash either
    // way, so a nonexistent email doesn't return measurably faster than
    // an existing one with a wrong password.
    const hashToCheck = admin?.passwordHash ?? DUMMY_HASH;
    const passwordMatches = await verify(hashToCheck, password).catch(() => false);

    if (!admin || !passwordMatches) {
      return { ok: false, reason: "invalid_credentials" };
    }

    if (admin.status !== "ACTIVE") {
      return { ok: false, reason: "disabled" };
    }

    // Successful login clears the rate-limit window for this email.
    await this.redis.client.del(rlKey);
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    this.logger.log(`Admin login: ${admin.email}`);

    return { ok: true, admin };
  }
}

// A pre-computed Argon2id hash of an arbitrary, never-used value —
// exists solely so the "no such admin" path takes the same code path
// (a real argon2 verify call) as the "wrong password" path.
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$KYVYxGSjw3/9zC9xhK1s5m6iZTVVYCTXFH9L98jvvyE";
