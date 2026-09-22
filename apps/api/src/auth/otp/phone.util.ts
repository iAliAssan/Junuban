const IRAN_MOBILE_LOCAL = /^09\d{9}$/; // e.g. 09121234567
const IRAN_MOBILE_E164 = /^\+989\d{9}$/; // e.g. +989121234567

/**
 * Normalizes an Iranian mobile number to E.164-ish form (+989xxxxxxxxx).
 * Accepts common user-entered formats: 09121234567, 989121234567,
 * +989121234567, with optional spaces/dashes.
 * Returns null if the input is not a valid Iranian mobile number.
 */
export function normalizeIranianMobile(raw: string): string | null {
  const cleaned = raw.replace(/[\s-]/g, "");

  if (IRAN_MOBILE_E164.test(cleaned)) {
    return cleaned;
  }
  if (IRAN_MOBILE_LOCAL.test(cleaned)) {
    return `+98${cleaned.slice(1)}`;
  }
  if (/^989\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  return null;
}
