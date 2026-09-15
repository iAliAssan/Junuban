import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { ClipboardListIcon } from "@/components/ui/icons";
import styles from "./admin-dashboard.module.css";

export const metadata: Metadata = {
  title: "داشبورد",
};

/**
 * Server component shell around the (necessarily client) AdminShell —
 * the dashboard's own content has no data-fetching of its own to do
 * here, since there is no dashboard-stats endpoint yet (see the
 * "بخش‌های ناقص" card below and IMPLEMENTATION_STATUS.md for what
 * that means for Cycle 9). Nothing here reads real numbers and prints
 * a placeholder in their place — the honest options were "wire up a
 * real stats endpoint" or "say plainly that one doesn't exist yet",
 * and since the former isn't a real backend capability today, this
 * page does the latter rather than inventing "۱۲۴ سفارش"-style numbers.
 */
export default function AdminDashboardPage() {
  return (
    <AdminShell>
      <h1 className={styles.title}>داشبورد</h1>

      <div className={styles.grid}>
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

        <section className={`${styles.card} ${styles.pendingCard}`}>
          <h2 className={styles.cardTitle}>بخش‌های در دست ساخت</h2>
          <p className={styles.cardBody}>
            مدیریت محصولات، دسته‌بندی‌ها، تولیدکنندگان و موجودی هنوز از طریق API پشتیبانی نمی‌شود و در
            نسخه‌های بعدی این پنل اضافه خواهد شد.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}
