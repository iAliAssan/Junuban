import { randomBytes, createHmac } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AppConfig } from "../../../config/configuration";
import type { AdminSession } from "@prisma/client";

const SESSION_TOKEN_BYTES = 32;

/**
 * Admin session handling — intentionally a separate service from the
 * customer `SessionService`, not a shared/generic one. Admin and
 * customer identity are different security domains (see master prompt
 * §6): different cookie, different table, different (shorter) lifetime,
 * and never any code path that could confuse the two. Reuses the same
 * `session.hashSecret` as customer sessions for HMAC signing (a secret,
 * not a namespace — token values are single-use random bytes and
 * collision between the two token spaces is cryptographically
 * negligible), but every other property (storage, TTL, cookie name) is
 * distinct.
 */
@Injectable()
export class AdminSessionService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  private hashToken(token: string): string {
    const secret = this.config.get("session", { infer: true }).hashSecret;
    return createHmac("sha256", secret).update(`admin:${token}`).digest("hex");
  }

  /**
   * Creates a new admin session. Returns the RAW token — this is the
   * only time it exists in memory; only its hash is persisted. Caller
   * sets it as the `junuban_admin_session` httpOnly cookie.
   */
  async createSession(
    adminId: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<{ token: string; session: AdminSession }> {
    const adminSessionConfig = this.config.get("adminSession", { infer: true });
    const token = randomBytes(SESSION_TOKEN_BYTES).toString("hex");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + adminSessionConfig.ttlHours * 60 * 60 * 1000);

    const session = await this.prisma.adminSession.create({
      data: {
        adminId,
        tokenHash,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt,
      },
    });

    return { token, session };
  }

  /**
   * Validates a raw token from the admin session cookie. Unlike the
   * customer session, this does NOT roll the expiry forward on every
   * request — admin sessions are short-lived by design (default 12h)
   * and a hard TTL is the safer default for a surface that can mutate
   * orders, inventory, and pricing. Returns null for missing/expired/
   * revoked sessions; callers must treat that as "not authenticated".
   */
  async validate(rawToken: string): Promise<AdminSession | null> {
    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.adminSession.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;

    // Touching lastSeenAt is a fire-and-forget audit convenience, not
    // part of the expiry calculation — safe to not await strictly, but
    // we await it anyway to keep behavior deterministic for tests.
    await this.prisma.adminSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return session;
  }

  async revoke(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.adminSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes every active session for an admin (e.g. on password change, disable). */
  async revokeAllForAdmin(adminId: string): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  get cookieName(): string {
    return this.config.get("adminSession", { infer: true }).cookieName;
  }

  get cookieMaxAgeMs(): number {
    return this.config.get("adminSession", { infer: true }).ttlHours * 60 * 60 * 1000;
  }
}
