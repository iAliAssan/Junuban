import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { ClipboardListIcon, BoxIcon, TagIcon, UsersIcon, GiftIcon } from "@/components/ui/icons";
import styles from "./admin-dashboard.module.css";

export const metadata: Metadata = {
  title: "داشبورد",
};

/**
 * Server component shell around the (necessarily client) AdminShell —
 * the dashboard's own content has no data-fetching of its own to do
 * here, since there is no dashboard-stats endpoint yet. Nothing here
 * reads real numbers and prints a placeholder in their place — the
 * honest options were "wire up a real stats endpoint" or "say plainly
 * that one doesn't exist yet", and since the former isn't a real
 * backend capability today, this page does the latter rather than
 * inventing "۱۲۴ سفارش"-style numbers. It links to every management
 * area that DOES have a working admin API/UI today.
 */
export default function AdminDashboardPage() {
  return (
    <AdminShell>
      <h1 className={styles.title}>داشبورد</h1>

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardIcon}>
            <BoxIcon width={22} height={22} />
          </div>
          <h2 className={styles.cardTitle}>محصولات</h2>
          <p className={styles.cardBody}>ایجاد و ویرایش محصولات، تعیین تولیدکننده، وزن، قیمت و موجودی.</p>
          <Link href="/admin/products" className={styles.cardLink}>
            مشاهده محصولات
          </Link>
        </section>

        <section className={styles.card}>
          <div className={styles.cardIcon}>
            <TagIcon width={22} height={22} />
          </div>
          <h2 className={styles.cardTitle}>دسته‌بندی‌ها</h2>
          <p className={styles.cardBody}>مدیریت دسته‌بندی‌های محصول که در فرم ایجاد/ویرایش محصول استفاده می‌شوند.</p>
          <Link href="/admin/categories" className={styles.cardLink}>
            مشاهده دسته‌بندی‌ها
          </Link>
        </section>

        <section className={styles.card}>
          <div className={styles.cardIcon}>
            <UsersIcon width={22} height={22} />
          </div>
          <h2 className={styles.cardTitle}>تولیدکنندگان</h2>
          <p className={styles.cardBody}>مدیریت تولیدکنندگان و منطقه فعالیت آن‌ها برای اتصال به محصولات.</p>
          <Link href="/admin/producers" className={styles.cardLink}>
            مشاهده تولیدکنندگان
          </Link>
        </section>

        <section className={styles.card}>
          <div className={styles.cardIcon}>
            <GiftIcon width={22} height={22} />
          </div>
          <h2 className={styles.cardTitle}>گزینه‌های بسته‌بندی</h2>
          <p className={styles.cardBody}>مدیریت گزینه‌های بسته‌بندی قابل انتخاب مشتریان هنگام خرید.</p>
          <Link href="/admin/packaging-options" className={styles.cardLink}>
            مشاهده گزینه‌های بسته‌بندی
          </Link>
        </section>

        <section className={styles.card}>
          <div className={styles.cardIcon}>
            <ClipboardListIcon width={22} height={22} />
          </div>
          <h2 className={styles.cardTitle}>سفارش‌ها</h2>
          <p className={styles.cardBody}>مدیریت سفارش‌ها، بررسی وضعیت پرداخت و تایید پرداخت‌های دستی.</p>
          <Link href="/admin/orders" className={styles.cardLink}>
            مشاهده سفارش‌ها
          </Link>
        </section>
      </div>
    </AdminShell>
  );
}
