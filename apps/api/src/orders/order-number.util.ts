/** Formats "JB-20260912-A1B2C3" — date for humans, a short random suffix for uniqueness. */
export function formatOrderNumber(date: Date, randomSuffix: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `JB-${y}${m}${d}-${randomSuffix.toUpperCase()}`;
}

/** 6-character base36 suffix, collision-checked by the caller against the DB before use. */
export function randomOrderSuffix(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, "0");
}
