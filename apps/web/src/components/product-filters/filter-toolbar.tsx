import Link from "next/link";
import styles from "./filter-toolbar.module.css";
import { FilterPanel } from "./filter-panel";
import { SortMenu } from "./sort-menu";
import { SearchIcon } from "@/components/ui/icons";
import type { CategorySummary, ProducerSummary, ProductListQuery } from "@/lib/api";

function hasAnyActiveFilter(current: ProductListQuery, lockCategorySlug?: string): boolean {
  return Boolean(
    current.q ||
      (current.categorySlug && !lockCategorySlug) ||
      current.producerSlug ||
      current.minPrice !== undefined ||
      current.maxPrice !== undefined ||
      current.inStockOnly ||
      (current.sort && current.sort !== "newest"),
  );
}

export function FilterToolbar({
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
  /** On /category/[slug] pages the category is fixed by the route — don't let search/clear override it. */
  lockCategorySlug?: string;
}) {
  const anyActive = hasAnyActiveFilter(current, lockCategorySlug);

  return (
    <div className={styles.toolbar}>
      <form className={styles.searchField} method="get" action={action}>
        {lockCategorySlug && <input type="hidden" name="categorySlug" value={lockCategorySlug} />}
        {current.producerSlug && <input type="hidden" name="producerSlug" value={current.producerSlug} />}
        {current.minPrice !== undefined && <input type="hidden" name="minPrice" value={current.minPrice} />}
        {current.maxPrice !== undefined && <input type="hidden" name="maxPrice" value={current.maxPrice} />}
        {current.inStockOnly && <input type="hidden" name="inStockOnly" value="true" />}
        {current.sort && <input type="hidden" name="sort" value={current.sort} />}

        <label className="visually-hidden" htmlFor="toolbar-search">
          جست‌وجوی محصول
        </label>
        <input
          id="toolbar-search"
          className={styles.searchInput}
          type="search"
          name="q"
          defaultValue={current.q ?? ""}
          placeholder="جست‌وجوی محصول..."
        />
        <button type="submit" className={styles.searchSubmit} aria-label="جست‌وجو">
          <SearchIcon width={16} height={16} />
        </button>
      </form>

      <div className={styles.controls}>
        <FilterPanel
          action={action}
          categories={categories}
          producers={producers}
          current={current}
          lockCategorySlug={lockCategorySlug}
        />
        <SortMenu baseHref={action} current={current} />
        {anyActive && (
          <Link href={action} className={styles.clearLink}>
            پاک کردن همه
          </Link>
        )}
      </div>
    </div>
  );
}
