const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Converts ASCII digits in a string to Persian (Eastern Arabic) numerals. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

/** Formats a Toman integer amount with thousands separators and Persian numerals, e.g. 260000 -> "۲۶۰,۰۰۰ ت". */
export function formatToman(amount: number): string {
  const withSeparators = amount.toLocaleString("en-US");
  return `${toPersianDigits(withSeparators)} ت`;
}
