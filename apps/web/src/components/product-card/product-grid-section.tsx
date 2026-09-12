import Link from "next/link";
import styles from "./product-grid-section.module.css";
import { ProductCard } from "./product-card";
import { ArrowIcon } from "../ui/icons";
import type { ProductSummary } from "@/lib/api";

export function ProductGridSection({
  title,
  viewAllHref,
  products,
  loadError,
}: {
  title: string;
  viewAllHref: string;
  products: ProductSummary[];
  /** Pass a message when the catalog API call failed — never silently show nothing. */
  loadError?: string;
}) {
  return (
    <section className={styles.section} aria-labelledby={`${title}-heading`}>
      <div className="container">
        <div className={styles.headerRow}>
          <h2 id={`${title}-heading`} className={styles.title}>
            {title}
          </h2>
          <Link href={viewAllHref} className={styles.viewAll}>
            مشاهده همه
            <ArrowIcon width={16} height={16} />
          </Link>
        </div>

        {loadError ? (
          <div className={styles.emptyState} role="alert">
            <p>{loadError}</p>
          </div>
        ) : products.length === 0 ? (
          <div className={styles.emptyState}>
            <p>در حال حاضر محصولی برای نمایش وجود ندارد.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
