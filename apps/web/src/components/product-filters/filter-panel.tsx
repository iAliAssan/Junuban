"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./filter-panel.module.css";
import type { CategorySummary, ProducerSummary, ProductListQuery } from "@/lib/api";

function countActiveFilters(current: ProductListQuery, lockCategorySlug?: string): number {
  let count = 0;
  if (current.categorySlug && !lockCategorySlug) count += 1;
  if (current.producerSlug) count += 1;
  if (current.minPrice !== undefined) count += 1;
  if (current.maxPrice !== undefined) count += 1;
  if (current.inStockOnly) count += 1;
  return count;
}

export function FilterPanel({
  action,
  categories,
  producers,
  current,
  lockCategorySlug,
}: {
  action: string;
  categories: CategorySummary[];
  producers: ProducerSummary[];
  current: ProductListQuery;
  /** On /category/[slug] pages the category is fixed by the route — don't let the form override it. */
  lockCategorySlug?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function close(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close(true);
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.querySelector<HTMLElement>("select, input, button")?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeCount = countActiveFilters(current, lockCategorySlug);

  const panelContent =
    mounted && open
      ? createPortal(
          <>
            <div className={styles.scrim} onClick={() => close(false)} aria-hidden="true" />
            <div
              ref={panelRef}
              className={`${styles.panel} ${styles.panelOpen}`}
              role="dialog"
              aria-modal="true"
              aria-label="فیلترها"
            >
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>فیلترها</span>
                <button type="button" className={styles.iconButton} aria-label="بستن" onClick={() => close(true)}>
                  ✕
                </button>
              </div>

              <form className={styles.panelBody} method="get" action={action} id="filter-panel-form">
                {lockCategorySlug && <input type="hidden" name="categorySlug" value={lockCategorySlug} />}
                {/* Preserve search/sort so applying filters doesn't clear them. */}
                {current.q && <input type="hidden" name="q" value={current.q} />}
                {current.sort && <input type="hidden" name="sort" value={current.sort} />}

                {!lockCategorySlug && (
                  <div className={styles.field}>
                    <label htmlFor="filter-category">دسته‌بندی</label>
                    <select id="filter-category" name="categorySlug" defaultValue={current.categorySlug ?? ""}>
                      <option value="">همه دسته‌ها</option>
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {producers.length > 0 && (
                  <div className={styles.field}>
                    <label htmlFor="filter-producer">تولیدکننده</label>
                    <select id="filter-producer" name="producerSlug" defaultValue={current.producerSlug ?? ""}>
                      <option value="">همه تولیدکنندگان</option>
                      {producers.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={styles.field}>
                  <span id="filter-price-label">بازه قیمت (تومان)</span>
                  <div className={styles.priceRow} role="group" aria-labelledby="filter-price-label">
                    <input
                      type="number"
                      name="minPrice"
                      min={0}
                      placeholder="از"
                      aria-label="حداقل قیمت"
                      defaultValue={current.minPrice ?? ""}
                    />
                    <input
                      type="number"
                      name="maxPrice"
                      min={0}
                      placeholder="تا"
                      aria-label="حداکثر قیمت"
                      defaultValue={current.maxPrice ?? ""}
                    />
                  </div>
                </div>

                <div className={`${styles.field} ${styles.checkboxField}`}>
                  <input
                    id="filter-in-stock"
                    type="checkbox"
                    name="inStockOnly"
                    value="true"
                    defaultChecked={current.inStockOnly ?? false}
                  />
                  <label htmlFor="filter-in-stock">فقط کالاهای موجود</label>
                </div>
              </form>

              <div className={styles.panelFooter}>
                <button type="submit" form="filter-panel-form" className={styles.applyButton}>
                  اعمال فیلترها
                </button>
                <a href={action} className={styles.resetLink}>
                  پاک کردن
                </a>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className={styles.triggerWrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${activeCount > 0 ? styles.triggerActive : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        فیلترها
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </button>
      {panelContent}
    </div>
  );
}
