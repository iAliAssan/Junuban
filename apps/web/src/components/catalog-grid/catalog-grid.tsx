import styles from "./catalog-grid.module.css";
import { ProductCard } from "../product-card/product-card";
import { toPersianDigits } from "@/lib/format";
import type { ProductSummary } from "@/lib/api";

export function CatalogGridSkeleton() {
  return (
    <div className={styles.loadingGrid} aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className={styles.skeletonCard} />
      ))}
    </div>
  );
}

export function CatalogGrid({
  products,
  total,
  loadError,
}: {
  products: ProductSummary[];
  total: number;
  loadError?: string;
}) {
  if (loadError) {
    return (
      <div className={styles.errorState} role="alert">
        <p>{loadError}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>محصولی با این مشخصات پیدا نشد. فیلترها را تغییر دهید یا جست‌وجوی دیگری امتحان کنید.</p>
      </div>
    );
  }

  return (
    <>
      <p className={styles.resultsHeader} role="status">
        {toPersianDigits(total)} محصول یافت شد
      </p>
      <div className={styles.grid}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  );
}
