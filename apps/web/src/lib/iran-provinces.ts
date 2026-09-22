/**
 * All 31 provinces of Iran, in their standard official Persian form —
 * matching the exact wording already used in seeded Producer.province
 * values (see apps/api/prisma/seed.ts, e.g. "هرمزگان" not "استان
 * هرمزگان", "سیستان و بلوچستان" not an abbreviation). Producer.province
 * is a plain `String` column (see schema.prisma) with no enum/FK
 * constraint, so this list is purely a UI convenience — the database
 * value is unaffected and a differently-worded string could still be
 * written directly, but every admin-facing province input should go
 * through this list so values stay consistent and filterable.
 *
 * Ordered alphabetically by Persian name (standard convention for this
 * kind of reference list in Persian UI), not administrative code order.
 */
export const IRAN_PROVINCES = [
  "آذربایجان شرقی",
  "آذربایجان غربی",
  "اردبیل",
  "اصفهان",
  "البرز",
  "ایلام",
  "بوشهر",
  "تهران",
  "چهارمحال و بختیاری",
  "خراسان جنوبی",
  "خراسان رضوی",
  "خراسان شمالی",
  "خوزستان",
  "زنجان",
  "سمنان",
  "سیستان و بلوچستان",
  "فارس",
  "قزوین",
  "قم",
  "کردستان",
  "کرمان",
  "کرمانشاه",
  "کهگیلویه و بویراحمد",
  "گلستان",
  "گیلان",
  "لرستان",
  "مازندران",
  "مرکزی",
  "هرمزگان",
  "همدان",
  "یزد",
] as const;

export type IranProvince = (typeof IRAN_PROVINCES)[number];
