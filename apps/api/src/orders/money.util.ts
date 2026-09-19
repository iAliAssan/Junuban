/** Formats an integer Toman amount with thousand separators for plain-text messages (e.g. SMS/payment instructions). Not for UI — the frontend has its own Persian-digit formatter (lib/format.ts). */
export function formatTomanForBackend(amount: number): string {
  return amount.toLocaleString("en-US");
}
