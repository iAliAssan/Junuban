import Link from "next/link";
import styles from "./footer.module.css";
import { toPersianDigits } from "@/lib/format";

const COLUMNS = [
  {
    title: "فروشگاه",
    links: [
      { href: "/products", label: "همه محصولات" },
      { href: "/category/gift-boxes", label: "جعبه‌های هدیه" },
      { href: "/producers", label: "تولیدکنندگان" },
      { href: "/search", label: "جست‌وجو" },
    ],
  },
  {
    title: "درباره جنوبان",
    links: [
      { href: "/about", label: "درباره ما" },
      { href: "/about/producers", label: "داستان تولیدکنندگان" },
      { href: "/authenticity", label: "ضمانت اصالت" },
      { href: "/guide", label: "راهنمای خرید" },
    ],
  },
  {
    title: "پشتیبانی",
    links: [
      { href: "/shipping-returns", label: "ارسال و بازگشت کالا" },
      { href: "/contact", label: "تماس با ما" },
      { href: "/orders/track", label: "پیگیری سفارش" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.grid}>
          <div>
            <p className={styles.brand}>جنوبان</p>
            <p className={styles.brandBody}>
              محصولات اصیل جنوب ایران — خرما، ادویه، گیاهان دارویی و صنایع‌دستی — مستقیم از
              تولیدکنندگان واقعی، با ضمانت اصالت.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className={styles.colTitle}>{col.title}</p>
              <ul className={styles.linkList}>
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className={styles.bottomRow}>
          <p>© {toPersianDigits(year)} جنوبان. تمامی حقوق محفوظ است.</p>
          <p>ساخته‌شده با اعتماد به تولیدکنندگان جنوب ایران</p>
        </div>
      </div>
    </footer>
  );
}
