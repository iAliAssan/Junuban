import Link from "next/link";
import styles from "./hero.module.css";
import { ArrowIcon } from "../ui/icons";
import { formatToman, toPersianDigits } from "@/lib/format";

export interface HeroStats {
  producerCount: number;
  provinceCount: number;
  satisfactionScore: number;
}

export interface HeroFeaturedProduct {
  name: string;
  region: string;
  producerName: string;
  price: number;
}

export function Hero({
  stats,
  featuredProduct,
}: {
  stats: HeroStats | null;
  featuredProduct: HeroFeaturedProduct | null;
}) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`container ${styles.grid}`}>
        <div>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            فصل برداشت ۱۴۰۳ آغاز شد
          </p>
          <h1 id="hero-title" className={styles.title}>
            محصولات اصیل جنوب ایران، مستقیم از تولیدکننده
          </h1>
          <p className={styles.body}>
            جنوبان محصولات اصیل خرما، ادویه، گیاهان دارویی و صنایع‌دستی جنوب ایران را مستقیم از
            تولیدکنندگان واقعی خریداری و به دست شما می‌رساند — بدون واسطه.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/products" className={styles.btnPrimary}>
              <ArrowIcon width={18} height={18} />
              مشاهده محصولات
            </Link>
            <Link href="/producers" className={styles.btnSecondary}>
              آشنایی با تولیدکنندگان
            </Link>
          </div>

          {stats ? (
            <dl className={styles.stats}>
              <div>
                <dt className="visually-hidden">تعداد تولیدکنندگان</dt>
                <dd className={styles.statNumber}>{toPersianDigits(stats.producerCount)}</dd>
                <span className={styles.statLabel}>تولیدکننده واقعی</span>
              </div>
              <div>
                <dt className="visually-hidden">تعداد استان‌ها</dt>
                <dd className={styles.statNumber}>{toPersianDigits(stats.provinceCount)}</dd>
                <span className={styles.statLabel}>استان جنوبی</span>
              </div>
              <div>
                <dt className="visually-hidden">رضایت مشتریان</dt>
                <dd className={styles.statNumber}>{toPersianDigits(stats.satisfactionScore.toFixed(1))}</dd>
                <span className={styles.statLabel}>رضایت مشتریان</span>
              </div>
            </dl>
          ) : null}
        </div>

        <div className={styles.visual} role="img" aria-label="تصویر محصولات جنوب ایران">
          <span className={styles.markPill}>
            <span className={styles.markDot} aria-hidden="true" />
            فصل برداشت ۱۴۰۳
          </span>

          {featuredProduct ? (
            <div className={styles.infoCard}>
              <p className={styles.infoCardName}>{featuredProduct.name}</p>
              <p className={styles.infoCardMeta}>
                {featuredProduct.region} — {featuredProduct.producerName}
              </p>
              <p className={styles.infoCardPrice}>{formatToman(featuredProduct.price)}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
