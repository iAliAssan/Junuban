import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AdminAuthenticatedRequest } from "./admin-session.guard";

/**
 * Restricts a route to OWNER-role admins only. Must be applied AFTER
 * AdminSessionGuard in the guard chain (`@UseGuards(AdminSessionGuard,
 * AdminOwnerGuard)`) since it reads `request.adminRole`, which only the
 * session guard sets. This is server-side enforcement per master prompt
 * §6/§24 — Staff can never reach an Owner-only endpoint by manipulating
 * the frontend, because the check happens here, not in UI visibility.
 */
@Injectable()
export class AdminOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    if (request.adminRole !== "OWNER") {
      throw new ForbiddenException("این عملیات مخصوص مالک فروشگاه است");
    }
    return true;
  }
}
