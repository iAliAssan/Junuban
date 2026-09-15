import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { AdminRole } from "@prisma/client";
import { AdminSessionService } from "../session/admin-session.service";
import { PrismaService } from "../../../prisma/prisma.service";

export interface AdminAuthenticatedRequest extends Request {
  adminId?: string;
  adminRole?: AdminRole;
}

/**
 * Guards admin-only routes. Distinct from CustomerSessionGuard — reads
 * the separate `junuban_admin_session` cookie and validates against
 * AdminSession, never CustomerSession. Also re-checks the admin's
 * current `status` on every request (not just at login) so disabling a
 * staff account takes effect immediately, even on an already-issued
 * session, rather than waiting for the session to expire.
 */
@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    private readonly sessions: AdminSessionService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    const token = request.cookies?.[this.sessions.cookieName];
    if (!token) {
      throw new UnauthorizedException("ورود به بخش مدیریت لازم است");
    }

    const session = await this.sessions.validate(token);
    if (!session) {
      throw new UnauthorizedException("نشست مدیریت شما منقضی شده است، دوباره وارد شوید");
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: session.adminId },
      select: { id: true, role: true, status: true },
    });
    if (!admin || admin.status !== "ACTIVE") {
      throw new UnauthorizedException("دسترسی این حساب غیرفعال شده است");
    }

    request.adminId = admin.id;
    request.adminRole = admin.role;
    return true;
  }
}
