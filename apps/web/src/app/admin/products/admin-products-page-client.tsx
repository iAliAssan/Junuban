"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  adminProductsApi,
  AdminApiError,
  type AdminProductListItem,
  type AdminProductFormOptions,
  type AdminProductStatus,
} from "@/lib/admin-products-client";
import { formatToman, toPersianDigits } from "@/lib/format";
import { PlusIcon } from "@/components/ui/icons";
import styles from "./admin-products-page.module.css";

const STATUS_FILTERS: { value: AdminProductStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "همه" },
  { value: "DRAFT", label: "پیش‌نویس" },
  { value: "ACTIVE", label: "منتشرشده" },
  { value: "ARCHIVED", label: "بایگانی‌شده" },
];

const STATUS_BADGE_CLASS: Record<AdminProductStatus, string> = {
  DRAFT: "badgeDraft",
  ACTIVE: "badgeActive",
  ARCHIVED: "badgeArchived",
};

const STATUS_LABEL: Record<AdminProductStatus, string> = {
  DRAFT: "پیش‌نویس",
  ACTIVE: "منتشرشده",
  ARCHIVED: "بایگانی‌شده",
};

type LoadState = "loading" | "loaded" | "error";

export function AdminProductsPageClient() {
  const [statusFilter, setStatusFilter] = useState<AdminProductStatus | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formOptions, setFormOptions] = useState<AdminProductFormOptions | null>(null);

  // Debounce free-text search so every keystroke doesn't trigger a request.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    adminProductsApi.formOptions().then(setFormOptions).catch(() => {
      // Category filter chips simply don't render without this — the
      // list itself still works fully without it, so this failure is
      // silent rather than blocking the whole page.
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setErrorMessage(null);

    adminProductsApi
      .list({
        page: 1,
        pageSize: 50,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        categoryId: categoryFilter === "ALL" ? undefined : categoryFilter,
        q: debouncedSearch || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setProducts(res.items);
        setTotal(res.total);
        setState("loaded");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof AdminApiError ? err.message : "دریافت محصولات با خطا مواجه شد");
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, categoryFilter, debouncedSearch]);

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>محصولات</h1>
        <Link href="/admin/products/new" className={styles.newButton}>
          <PlusIcon width={18} height={18} />
          محصول جدید
        </Link>
      </div>

      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="جستجوی نام یا شناسه محصول..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="جستجوی محصولات"
        />

        <div className={styles.filters} role="group" aria-label="فیلتر وضعیت محصول">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`${styles.filterChip} ${statusFilter === f.value ? styles.filterChipActive : ""}`}
              aria-pressed={statusFilter === f.value}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {formOptions && formOptions.categories.length > 0 && (
          <select
            className={styles.categorySelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="فیلتر دسته‌بندی"
          >
            <option value="ALL">همه دسته‌بندی‌ها</option>
            {formOptions.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {state === "loading" && (
        <div className={styles.skeletonList} aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
          <span className="visually-hidden" role="status">
            در حال بارگذاری محصولات...
          </span>
        </div>
      )}

      {state === "error" && (
        <p className={styles.errorState} role="alert">
          {errorMessage}
        </p>
      )}

      {state === "loaded" && products.length === 0 && (
        <p className={styles.emptyState}>محصولی با این فیلتر یافت نشد.</p>
      )}

      {state === "loaded" && products.length > 0 && (
        <>
          <p className={styles.totalLabel}>{toPersianDigits(total)} محصول</p>

          <table className={styles.table}>
            <thead>
              <tr>
                <th className="visually-hidden">تصویر</th>
                <th>نام محصول</th>
                <th>دسته‌بندی</th>
                <th>وضعیت</th>
                <th>قیمت از</th>
                <th>تنوع‌ها</th>
                <th>موجودی کل (گرم)</th>
                <th className="visually-hidden">جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td data-label="" className={styles.imageCell}>
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image.url} alt={product.image.altText} className={styles.thumb} />
                    ) : (
                      <div className={styles.thumbPlaceholder} aria-hidden="true" />
                    )}
                  </td>
                  <td data-label="نام محصول">
                    <Link href={`/admin/products/${product.id}`} className={styles.nameLink}>
                      {product.name}
                    </Link>
                  </td>
                  <td data-label="دسته‌بندی">{product.category.name}</td>
                  <td data-label="وضعیت">
                    <span className={`${styles.statusBadge} ${styles[STATUS_BADGE_CLASS[product.status]]}`}>
                      {STATUS_LABEL[product.status]}
                    </span>
                  </td>
                  <td data-label="قیمت از">{product.priceFrom !== null ? formatToman(product.priceFrom) : "—"}</td>
                  <td data-label="تنوع‌ها">
                    {toPersianDigits(product.variantCount)} ({toPersianDigits(product.producerCount)} تولیدکننده)
                  </td>
                  <td data-label="موجودی کل">{toPersianDigits(product.totalOnHandGrams)}</td>
                  <td data-label="">
                    <Link href={`/admin/products/${product.id}`} className={styles.detailLink}>
                      مشاهده / ویرایش
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
