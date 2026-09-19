import Link from "next/link";
import styles from "./promo-banner.module.css";
import { ArrowIcon } from "../ui/icons";

export interface PromoBannerContent {
  title: string;
  body: string;
  href: string;
}

export function PromoBanner({ content }: { content: PromoBannerContent | null }) {
  if (!content) return null;

  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.banner}>
          <span className={styles.eyebrow}>پیشنهاد ویژه</span>
          <h2 className={styles.title}>{content.title}</h2>
          <p className={styles.body}>{content.body}</p>
          <Link href={content.href} className={styles.cta}>
            مشاهده جعبه‌های هدیه
            <ArrowIcon width={16} height={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
