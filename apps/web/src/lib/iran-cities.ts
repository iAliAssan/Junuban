import { IRAN_PROVINCES, type IranProvince } from "./iran-provinces";

/**
 * Major cities per Iranian province, bundled locally rather than fetched
 * from a runtime API (per the explicit requirement: prefer a local/
 * static dataset so checkout never depends on an external API being
 * online). This is not an exhaustive list of every town — it covers the
 * provincial capital plus other well-known major cities, which is
 * sufficient for a shipping-address city selector without a payload of
 * thousands of village-level entries the storefront doesn't need.
 *
 * Keys match IRAN_PROVINCES exactly (enforced by the Record<IranProvince, ...>
 * type below) so a province selection always resolves to a real city list.
 */
export const IRAN_CITIES_BY_PROVINCE: Record<IranProvince, string[]> = {
  "آذربایجان شرقی": ["تبریز", "مراغه", "میانه", "مرند", "اهر", "بناب", "شبستر", "سراب"],
  "آذربایجان غربی": ["ارومیه", "خوی", "مهاباد", "بوکان", "میاندوآب", "سلماس", "پیرانشهر"],
  "اردبیل": ["اردبیل", "مشگین‌شهر", "پارس‌آباد", "خلخال", "گرمی", "بیله‌سوار"],
  "اصفهان": ["اصفهان", "کاشان", "نجف‌آباد", "خمینی‌شهر", "شاهین‌شهر", "نائین", "فولادشهر", "مبارکه"],
  "البرز": ["کرج", "فردیس", "نظرآباد", "هشتگرد", "اشتهارد", "طالقان"],
  "ایلام": ["ایلام", "دهلران", "آبدانان", "ایوان", "دره‌شهر"],
  "بوشهر": ["بوشهر", "برازجان", "گناوه", "کنگان", "دیر", "دیلم"],
  "تهران": ["تهران", "شهریار", "اسلامشهر", "ورامین", "پاکدشت", "پردیس", "دماوند", "ری", "رباط‌کریم"],
  "چهارمحال و بختیاری": ["شهرکرد", "بروجن", "فارسان", "لردگان", "اردل"],
  "خراسان جنوبی": ["بیرجند", "قائنات", "فردوس", "طبس", "سربیشه"],
  "خراسان رضوی": ["مشهد", "نیشابور", "سبزوار", "تربت‌حیدریه", "قوچان", "کاشمر", "تربت‌جام"],
  "خراسان شمالی": ["بجنورد", "شیروان", "اسفراین", "جاجرم"],
  "خوزستان": ["اهواز", "آبادان", "خرمشهر", "دزفول", "ماهشهر", "بندر ماهشهر", "شوشتر", "بهبهان", "اندیمشک"],
  "زنجان": ["زنجان", "ابهر", "خدابنده", "ماه‌نشان"],
  "سمنان": ["سمنان", "شاهرود", "دامغان", "گرمسار"],
  "سیستان و بلوچستان": ["زاهدان", "زابل", "ایرانشهر", "چابهار", "خاش", "سراوان"],
  "فارس": ["شیراز", "مرودشت", "جهرم", "کازرون", "فسا", "لار", "داراب", "استهبان"],
  "قزوین": ["قزوین", "الوند", "تاکستان", "آبیک", "بوئین‌زهرا"],
  "قم": ["قم"],
  "کردستان": ["سنندج", "سقز", "مریوان", "بانه", "قروه", "بیجار"],
  "کرمان": ["کرمان", "رفسنجان", "سیرجان", "بم", "جیرفت", "زرند", "شهربابک"],
  "کرمانشاه": ["کرمانشاه", "اسلام‌آباد غرب", "سنقر", "پاوه", "هرسین", "کنگاور"],
  "کهگیلویه و بویراحمد": ["یاسوج", "گچساران", "دوگنبدان", "دهدشت"],
  "گلستان": ["گرگان", "گنبد کاووس", "علی‌آباد کتول", "آق‌قلا", "کردکوی", "بندر ترکمن"],
  "گیلان": ["رشت", "بندر انزلی", "لاهیجان", "آستارا", "لنگرود", "رودسر", "تالش", "فومن"],
  "لرستان": ["خرم‌آباد", "بروجرد", "دورود", "الیگودرز", "کوهدشت", "ازنا"],
  "مازندران": ["ساری", "بابل", "آمل", "قائم‌شهر", "بابلسر", "نوشهر", "چالوس", "تنکابن", "رامسر"],
  "مرکزی": ["اراک", "ساوه", "خمین", "دلیجان", "محلات", "تفرش"],
  "هرمزگان": ["بندرعباس", "میناب", "بندر لنگه", "قشم", "کیش", "رودان", "بستک"],
  "همدان": ["همدان", "ملایر", "نهاوند", "تویسرکان", "اسدآباد", "کبودرآهنگ"],
  "یزد": ["یزد", "میبد", "اردکان", "بافق", "مهریز", "تفت"],
};

// Defense-in-depth: fail loudly at import time (a dev-time/build-time
// error, never something a customer could hit) if this list ever
// silently drifts from IRAN_PROVINCES — e.g. a province gets renamed in
// one file but not the other — rather than resolving to `undefined` and
// breaking the city selector for one specific province in production.
const missing = IRAN_PROVINCES.filter((p) => !(p in IRAN_CITIES_BY_PROVINCE));
if (missing.length > 0) {
  throw new Error(`IRAN_CITIES_BY_PROVINCE is missing cities for: ${missing.join(", ")}`);
}

export function citiesForProvince(province: string): string[] {
  return (IRAN_CITIES_BY_PROVINCE as Record<string, string[] | undefined>)[province] ?? [];
}
