import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import type { Cart } from "@prisma/client";
import { SessionService } from "../auth/session/session.service";
import { CartService } from "./cart.service";
import type { AppConfig } from "../config/configuration";

const GUEST_TOKEN_BYTES = 24;

@Injectable()
export class CartContextService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly sessions: SessionService,
    private readonly cart: CartService,
  ) {}

  /**
   * Resolves (and if necessary creates) the Cart for this request.
   * Precedence: a valid customer session always wins — once logged in,
   * the customer's own cart is authoritative, never the guest cart, even
   * if a stale guest cookie is still present (merging that stale guest
   * cart is handled separately, at login time — see mergeGuestCartOnLogin
   * in CartService, called from AuthController).
   *
   * Always sets the guest cookie on `res` when a guest cart is used and
   * no cookie existed yet, so the server remains authoritative over the
   * cart's identity rather than trusting anything the client invents.
   */
  async resolveCart(req: Request, res: Response): Promise<Cart> {
    const sessionToken = req.cookies?.[this.sessions.cookieName] as string | undefined;
    if (sessionToken) {
      const session = await this.sessions.validateAndTouch(sessionToken);
      if (session) {
        return this.cart.getOrCreateCustomerCart(session.customerId);
      }
    }

    const guestCartConfig = this.config.get("guestCart", { infer: true });
    let guestToken = req.cookies?.[guestCartConfig.cookieName] as string | undefined;

    if (!guestToken) {
      guestToken = randomBytes(GUEST_TOKEN_BYTES).toString("hex");
      res.cookie(guestCartConfig.cookieName, guestToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: guestCartConfig.maxAgeDays * 24 * 60 * 60 * 1000,
        path: "/",
      });
    }

    return this.cart.getOrCreateGuestCart(guestToken);
  }

  get guestCookieName(): string {
    return this.config.get("guestCart", { infer: true }).cookieName;
  }
}
