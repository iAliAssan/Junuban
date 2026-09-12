"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import styles from "./sort-menu.module.css";
import { useDismissiblePopover } from "@/lib/use-dismissible-popover";
import { buildProductQuery, type ProductListQuery } from "@/lib/api";

// Only sort values the backend's ListProductsQueryDto actually accepts
// (see apps/api/src/catalog/dto/list-products.dto.ts PRODUCT_SORT_VALUES)
// — never expose an option the API would reject.
const SORT_OPTIONS: { value: NonNullable<ProductListQuery["sort"]>; label: string }[] = [
  { value: "newest", label: "جدیدترین" },
  { value: "best_selling", label: "پرفروش‌ترین" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
];

export function SortMenu({
  baseHref,
  current,
}: {
  /** The listing URL to sort within, e.g. "/products" or "/category/dates". */
  baseHref: string;
  current: ProductListQuery;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useDismissiblePopover(wrapperRef, open, () => setOpen(false));

  const activeOption = SORT_OPTIONS.find((o) => o.value === (current.sort ?? "newest")) ?? SORT_OPTIONS[0];

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="sort-menu-panel"
        onClick={() => setOpen((v) => !v)}
      >
        مرتب‌سازی: {activeOption?.label}
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div id="sort-menu-panel" className={styles.menu} role="menu" aria-label="مرتب‌سازی نتایج">
          {SORT_OPTIONS.map((option) => {
            const isActive = option.value === activeOption?.value;
            return (
              <Link
                key={option.value}
                href={`${baseHref}${buildProductQuery({ ...current, sort: option.value, page: undefined })}`}
                role="menuitem"
                className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => setOpen(false)}
              >
                {option.label}
                {isActive && <span aria-hidden="true">✓</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
