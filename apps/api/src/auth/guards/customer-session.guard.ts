import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { SessionService } from "../session/session.service";

export interface AuthenticatedRequest extends Request {
  customerId?: string;
}

@Injectable()
export class CustomerSessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[this.sessions.cookieName];
    if (!token) {
      throw new UnauthorizedException("لازم است وارد حساب کاربری خود شوید");
    }

    const session = await this.sessions.validateAndTouch(token);
    if (!session) {
      throw new UnauthorizedException("نشست شما منقضی شده است، دوباره وارد شوید");
    }

    request.customerId = session.customerId;
    return true;
  }
}
