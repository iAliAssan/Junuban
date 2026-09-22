import { randomBytes } from "node:crypto";

/**
 * Customer-facing order number: "AU-GXM14L7" — no embedded date. The
 * previous format ("JB-20260912-A1B2C3") baked the creation date into
 * the number itself, which made it longer than necessary to read, copy,
 * or read aloud over a phone call. Nothing else in the codebase parses
 * a date back out of this string (checked: it's treated as an opaque
 * unique identifier everywhere it's used), so dropping the date segment
 * is safe.
 *
 * "AU" rather than the previous "JB" — matches the storefront's actual
 * public brand/domain ("Auron"/auron.ir) rather than an internal
 * abbreviation.
 */
export function formatOrderNumber(randomSuffix: string): string {
  return `AU-${randomSuffix.toUpperCase()}`;
}

/**
 * 7-character, cryptographically-random, uppercase base36 (0-9, A-Z)
 * suffix — collision-checked by the caller (OrdersService.checkout)
 * against the DB before use, with a retry loop, so this only needs to
 * be "collision-resistant enough that a retry is rare," not
 * "guaranteed unique on its own." Bumped from the previous 6 characters
 * to 7 specifically because dropping the date segment (see
 * formatOrderNumber) removes a source of collision-avoidance the old
 * format got for free (two orders on different days could reuse the
 * same 6-char suffix without ever colliding) — 7 base36 characters is
 * ~36 bits of entropy, comfortably enough for any realistic order
 * volume when paired with the DB-level uniqueness check.
 *
 * Uses `crypto.randomBytes`, not `Math.random()` — `Math.random()` is
 * not a CSPRNG and, more importantly for this specific use, converting
 * its float output via `.toString(36)` does not spread entropy evenly
 * across all output characters. Order numbers aren't a security
 * boundary on their own (see the tracking-page access-control notes
 * elsewhere), but there's no reason to reach for the weaker generator
 * once `crypto` is already a zero-cost, no-new-dependency choice.
 */
export function randomOrderSuffix(): string {
  const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = randomBytes(7);
  let result = "";
  for (let i = 0; i < 7; i++) {
    result += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return result;
}
