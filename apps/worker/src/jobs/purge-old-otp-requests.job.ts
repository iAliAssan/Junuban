import { PrismaClient } from "@prisma/client";

/**
 * `OtpRequest` rows are a permanent-by-default audit trail (see the
 * schema comment on OtpService's rate limiting / auth.controller.ts's
 * ipAddress/userAgent capture) — they record who requested what code,
 * from where, and whether it was ever verified, which matters for
 * abuse investigation. But nothing was ever deleting them (see
 * apps/worker/package.json's own description, "OTP cleanup" — promised
 * but never actually implemented until this job), so the table grows
 * forever.
 *
 * This does NOT touch the live, still-usable OTP code itself — that
 * lives in Redis with its own short TTL (see OtpService.requestOtp) and
 * is already self-expiring. This job only prunes the long-term Postgres
 * audit record, well after any code in it could possibly still be live
 * or investigatively useful.
 *
 * Retention window: 90 days. Long enough to investigate a fraud/abuse
 * pattern reported well after the fact, short enough that the table
 * doesn't grow without bound on a busy storefront. Not configurable via
 * env var (unlike the reservation TTL, which is a customer-facing
 * checkout-experience knob) since this is purely an internal retention
 * policy — change the constant directly if the team's needs differ.
 */
const OTP_REQUEST_RETENTION_DAYS = 90;

export async function purgeOldOtpRequests(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - OTP_REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // A single deleteMany, unlike releaseExpiredReservations' per-row
  // transaction loop — there's no inventory/counter side effect to keep
  // in sync here, just a straightforward bulk delete of rows past their
  // retention window, so no per-row transaction or race guard is needed.
  const result = await prisma.otpRequest.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return result.count;
}
