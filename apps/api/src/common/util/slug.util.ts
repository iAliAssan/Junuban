/**
 * Slug helpers shared by every admin catalog module (products now;
 * categories/producers in later cycles reuse this same file rather than
 * each hand-rolling their own regex). A slug is always the URL-facing
 * identity of a Product/Category/Producer (`@unique` in schema.prisma)
 * — ASCII only, so Persian names still need an explicit slug typed by
 * the admin. This module never invents a Persian-to-Latin transliteration
 * scheme (that would produce unpredictable, hard-to-edit URLs); it only
 * normalizes and validates what the admin provides.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** True when `value` is already a valid slug — lowercase ASCII words joined by single hyphens, no leading/trailing/double hyphens. */
export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

/**
 * Best-effort normalization for slugs typed with stray casing/spacing
 * (e.g. "Sidr Honey" -> "sidr-honey"). Does NOT transliterate non-Latin
 * script — a Persian-only input normalizes to an empty string, which
 * `isValidSlug` correctly rejects, forcing the admin to supply an
 * explicit Latin slug rather than silently generating a broken one.
 */
export function normalizeSlugInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
