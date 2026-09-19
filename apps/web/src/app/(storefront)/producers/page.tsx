import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { apiGet, ApiError } from "@/lib/api";
import type { ProducerSummary } from "@/lib/api";
import { Breadcrumbs } from "@/components/breadcrumbs/breadcrumbs";
import styles from "./producers-page.module.css";

export const metadata: Metadata = {
  title: "تولیدکنندگان",
  description: "با تولیدکنندگان اصیل جنوب ایران که محصولات جنوبان از آن‌ها تامین می‌شود آشنا شوید.",
  alternates: { canonical: "/producers" },
};

export default async function ProducersPage() {
  let producers: ProducerSummary[] = [];
  let loadError: string | undefined;

  try {
    producers = await apiGet<ProducerSummary[]>("/producers");
  } catch (err) {
    loadError =
      err instanceof ApiError
        ? "در حال حاضر امکان بارگذاری تولیدکنندگان وجود ندارد. لطفاً بعداً دوباره تلاش کنید."
        : "خطایی در ارتباط با سرور رخ داد.";
  }

  return (
    <div className={styles.layout}>
      <Breadcrumbs
        baseUrl={process.env.APP_URL ?? "http://localhost:3000"}
        items={[{ label: "خانه", href: "/" }, { label: "تولیدکنندگان" }]}
      />

      <div className="container">
        <h1 className={styles.title}>تولیدکنندگان</h1>
        <p className={styles.subtitle}>
          هر محصول جنوبان، ریشه در یک منطقه و یک تولیدکننده واقعی دارد. با کلیک روی هر تولیدکننده،
          محصولات او را مشاهده کنید.
        </p>

        {loadError ? (
          <div className={styles.errorState} role="alert">
            <p>{loadError}</p>
          </div>
        ) : producers.length === 0 ? (
          <div className={styles.emptyState}>
            <p>در حال حاضر تولیدکننده‌ای برای نمایش وجود ندارد.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {producers.map((producer) => (
              <Link
                key={producer.id}
                href={`/products?producerSlug=${producer.slug}`}
                className={styles.card}
              >
                <span className={styles.avatarWrap} aria-hidden="true">
                  {producer.photo ? (
                    <Image
                      src={producer.photo.url}
                      alt=""
                      fill
                      sizes="56px"
                      className={styles.avatar}
                    />
                  ) : (
                    <span className={styles.avatar} />
                  )}
                </span>
                <span className={styles.info}>
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
        )}
      </div>
    </div>
  );
}
