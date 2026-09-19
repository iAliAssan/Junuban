import Link from "next/link";
import Image from "next/image";
import styles from "./producer-strip.module.css";
import { ArrowIcon } from "../ui/icons";

export interface ProducerStripItem {
  slug: string;
  name: string;
  region: string;
  verified: boolean;
  photo: { url: string; altText: string } | null;
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
            // Links to the products list filtered by this producer, not
            // a dedicated /producers/[slug] detail page — that route
            // doesn't exist (only /producers, a list, and /products?
            // producerSlug=..., a filter). This matches the working
            // pattern the actual /producers list page already uses
            // (see apps/web/src/app/(storefront)/producers/page.tsx) —
            // a previous version of this component linked to
            // /producers/${slug} instead, which 404'd on every click.
            <Link key={producer.slug} href={`/products?producerSlug=${producer.slug}`} className={styles.card}>
              <span className={styles.avatarWrap} aria-hidden="true">
                {producer.photo ? (
                  <Image src={producer.photo.url} alt="" fill sizes="56px" className={styles.avatar} />
                ) : (
                  <span className={styles.avatar} />
                )}
              </span>
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
