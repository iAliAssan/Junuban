import type { CookieOptions } from "express";

/**
 * Shared cookie attributes for the admin session, customer session, and
 * guest cart cookies.
 *
 * Why SameSite is env-dependent rather than a hardcoded "lax":
 *
 * The web app and API can be deployed as separate origins (for example
 * junuban-web.vercel.app and junuban-api.vercel.app — different
 * subdomains of vercel.app, which is itself on the public suffix list,
 * so browsers treat them as different sites). A SameSite=Lax cookie set
 * by the API is only sent back on top-level navigations to that domain;
 * it is NOT attached to the cross-site fetch() calls the browser makes
 * from junuban-web to junuban-api, even with `credentials: "include"`.
 * That is what produces "ارتباط با سرور برقرار نشد." on admin login —
 * the request can succeed but the session cookie set by it is silently
 * dropped by the browser, or CORS/preflight fails first.
 *
 * In production (always served over HTTPS) we use SameSite=None with
 * Secure=true, which browsers deliver on cross-site requests and which
 * also works fine if web and API end up on the same origin later (a
 * custom domain, or a Next.js rewrite proxy). Locally (plain HTTP,
 * same-origin dev servers) SameSite=None without HTTPS is rejected by
 * browsers, so we fall back to Lax there, which is sufficient for
 * same-origin/localhost development.
 */
function baseCookieAttributes(): Pick<CookieOptions, "secure" | "sameSite"> {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  };
}

/** Options for `res.cookie(...)` when setting a session/cart cookie. */
export function sessionCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    path: "/",
    maxAge: maxAgeMs,
    ...baseCookieAttributes(),
  };
}

/**
 * Options for `res.clearCookie(...)`. Browsers match a clearing cookie
 * against the original by name + path + domain + SameSite/Secure, so
 * this must mirror `sessionCookieOptions` (minus maxAge) or the clear
 * can silently fail in some browsers.
 */
export function clearSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    path: "/",
    ...baseCookieAttributes(),
  };
}
