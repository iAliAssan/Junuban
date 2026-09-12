import Link from "next/link";
import styles from "./category-rail.module.css";
import { toPersianDigits } from "@/lib/format";

export interface CategoryRailItem {
  slug: string;
  name: string;
  productCount: number;
}

export function CategoryRail({ categories }: { categories: CategoryRailItem[] }) {
  if (categories.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="category-rail-title">
      <h2 id="category-rail-title" className="visually-hidden">
        دسته‌بندی محصولات
      </h2>
      <div className={`container ${styles.grid}`}>
        {categories.map((category) => (
          <Link key={category.slug} href={`/category/${category.slug}`} className={styles.card}>
            <span className={styles.iconWrap} aria-hidden="true">
              {category.name.charAt(0)}
            </span>
            <span>
              <span className={styles.name}>{category.name}</span>
              <br />
              <span className={styles.count}>{toPersianDigits(category.productCount)} محصول</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
