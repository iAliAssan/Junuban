import { randomBytes, createHmac } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import type { AppConfig } from "../../config/configuration";
import type { CustomerSession } from "@prisma/client";

const SESSION_TOKEN_BYTES = 32;

@Injectable()
export class SessionService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  private hashToken(token: string): string {
    const secret = this.config.get("session", { infer: true }).hashSecret;
    return createHmac("sha256", secret).update(token).digest("hex");
  }

  /**
   * Creates a new session for `customerId`. Returns the RAW token —
   * this is the only time the raw value exists; only its hash is
   * persisted. The caller is responsible for setting it as the
   * `junuban_session` httpOnly cookie.
   */
  async createSession(
    customerId: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<{ token: string; session: CustomerSession }> {
    const sessionConfig = this.config.get("session", { infer: true });
    const token = randomBytes(SESSION_TOKEN_BYTES).toString("hex");
    const tokenHash = this.hashToken(token);
    const now = Date.now();

    const session = await this.prisma.customerSession.create({
      data: {
        customerId,
        tokenHash,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt: new Date(now + sessionConfig.renewalWindowDays * 24 * 60 * 60 * 1000),
        absoluteExpiresAt: new Date(now + sessionConfig.absoluteMaxDays * 24 * 60 * 60 * 1000),
      },
    });

    return { token, session };
  }

  /**
   * Validates a raw token from the session cookie. If valid and within
   * the renewal window, rolls the (non-absolute) expiry forward. Returns
   * null for missing/expired/revoked sessions — callers must treat that
   * as "not authenticated", never throw a raw DB error to the client.
   */
  async validateAndTouch(rawToken: string): Promise<CustomerSession | null> {
    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.customerSession.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt) return null;

    const now = new Date();
    if (session.expiresAt < now || session.absoluteExpiresAt < now) {
      return null;
    }

    const sessionConfig = this.config.get("session", { infer: true });
    const renewed = await this.prisma.customerSession.update({
      where: { id: session.id },
      data: {
        lastSeenAt: now,
        expiresAt: new Date(
          Math.min(
            now.getTime() + sessionConfig.renewalWindowDays * 24 * 60 * 60 * 1000,
            session.absoluteExpiresAt.getTime(),
          ),
        ),
      },
    });

    return renewed;
  }

  async revoke(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.customerSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes every active session for a customer (e.g. "log out everywhere"). */
  async revokeAllForCustomer(customerId: string): Promise<void> {
    await this.prisma.customerSession.updateMany({
      where: { customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  get cookieName(): string {
    return this.config.get("session", { infer: true }).cookieName;
  }

  get cookieMaxAgeMs(): number {
    return this.config.get("session", { infer: true }).absoluteMaxDays * 24 * 60 * 60 * 1000;
  }
}
