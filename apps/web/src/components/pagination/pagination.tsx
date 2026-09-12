import Link from "next/link";
import styles from "./pagination.module.css";
import { toPersianDigits } from "@/lib/format";

function pageWindow(current: number, total: number): (number | "ellipsis")[] {
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

export function Pagination({
  currentPage,
  totalPages,
  buildHref,
}: {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className={styles.nav} aria-label="صفحه‌بندی نتایج">
      <Link
        href={buildHref(Math.max(1, currentPage - 1))}
        className={`${styles.pageLink} ${currentPage === 1 ? styles.disabled : ""}`}
        aria-label="صفحه قبل"
        aria-disabled={currentPage === 1}
      >
        ‹
      </Link>

      {pageWindow(currentPage, totalPages).map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e-${i}`} className={styles.ellipsis} aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            className={`${styles.pageLink} ${p === currentPage ? styles.current : ""}`}
            aria-current={p === currentPage ? "page" : undefined}
          >
            {toPersianDigits(p)}
          </Link>
        ),
      )}

      <Link
        href={buildHref(Math.min(totalPages, currentPage + 1))}
        className={`${styles.pageLink} ${currentPage === totalPages ? styles.disabled : ""}`}
        aria-label="صفحه بعد"
        aria-disabled={currentPage === totalPages}
      >
        ›
      </Link>
    </nav>
  );
}
