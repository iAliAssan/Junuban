export const MIN_CART_QUANTITY = 1;
export const MAX_CART_QUANTITY = 99;

/**
 * Clamps a requested quantity to the allowed 1–99 package range.
 * Server-side authority — never trust a client-supplied quantity as-is
 * (see master prompt §35 / this cycle's §5).
 */
export function clampQuantity(requested: number): number {
  if (!Number.isFinite(requested)) return MIN_CART_QUANTITY;
  const floored = Math.floor(requested);
  return Math.min(MAX_CART_QUANTITY, Math.max(MIN_CART_QUANTITY, floored));
}

export interface CartLineKey {
  variantId: string;
  packagingOptionId: string | null;
}

/** Normalizes an optional/undefined packaging id to explicit `null` for consistent comparison and DB matching. */
export function normalizePackagingOptionId(id: string | null | undefined): string | null {
  return id ?? null;
}

/**
 * Two cart lines are the same sellable configuration only when both the
 * variant AND the packaging choice match exactly. A different packaging
 * choice is a commercially distinct line and must never be silently
 * merged (see this cycle's §3).
 */
export function sameCartLine(a: CartLineKey, b: CartLineKey): boolean {
  return a.variantId === b.variantId && a.packagingOptionId === b.packagingOptionId;
}
