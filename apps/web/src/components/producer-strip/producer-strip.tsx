import Link from "next/link";
import styles from "./producer-strip.module.css";
import { ArrowIcon } from "../ui/icons";

export interface ProducerStripItem {
  slug: string;
  name: string;
  region: string;
  verified: boolean;
}

export function ProducerStrip({ producers }: { producers: ProducerStripItem[] }) {
  if (producers.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="producer-strip-title">
      <div className="container">
        <div className={styles.headerRow}>
          <div>
            <h2 id="producer-strip-title" className={styles.title}>
              از میان تولیدکنندگان جنوب
            </h2>
            <p className={styles.subtitle}>هر محصول، یک نام و یک منطقه‌ی مشخص دارد.</p>
          </div>
          <Link href="/producers" className={styles.viewAll}>
            همه تولیدکنندگان
            <ArrowIcon width={16} height={16} />
          </Link>
        </div>

        <div className={styles.grid}>
          {producers.map((producer) => (
            <Link key={producer.slug} href={`/producers/${producer.slug}`} className={styles.card}>
              <span className={styles.avatar} aria-hidden="true" />
              <span>
                <span className={styles.name}>
                  {producer.name}
                  {producer.verified && (
                    <span className={styles.verifiedBadge} title="تایید شده" aria-label="تولیدکننده تایید شده">
                      ✓
                    </span>
                  )}
                </span>
                <br />
                <span className={styles.region}>{producer.region}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
