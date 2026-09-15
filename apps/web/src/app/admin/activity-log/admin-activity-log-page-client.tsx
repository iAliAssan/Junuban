"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError, type ActivityLogEntry } from "@/lib/admin-orders-client";
import { toPersianDigits } from "@/lib/format";
import styles from "./admin-activity-log-page.module.css";

const ACTION_LABELS: Record<string, string> = {
  "order.mark_paid": "تایید پرداخت سفارش",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

type LoadState = "loading" | "loaded" | "forbidden" | "error";

/**
 * This route is gated server-side by BOTH `AdminSessionGuard` and
 * `AdminOwnerGuard` (see `apps/api/src/admin/activity-log/
 * activity-log.controller.ts`) — a STAFF admin's request gets a real
 * 403 from the API, which this page must show as a real, honest
 * "you don't have access" state, not silently redirect or hide the
 * failure. The nav item is also hidden from STAFF for UX clarity (see
 * `admin-nav-items.ts`), but that's a convenience, not the actual
 * enforcement — the backend is, per master prompt §21.
 */
export function AdminActivityLogPageClient() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listActivityLog({ page: 1, pageSize: 50 })
      .then((res) => {
        setEntries(res.items);
        setTotal(res.total);
        setState("loaded");
      })
      .catch((err) => {
        if (err instanceof AdminApiError && err.status === 403) {
          setState("forbidden");
        } else {
          setErrorMessage(err instanceof AdminApiError ? err.message : "دریافت فعالیت‌ها با خطا مواجه شد");
          setState("error");
        }
      });
  }, []);

  return (
    <div>
      <h1 className={styles.title}>فعالیت‌های اخیر</h1>

      {state === "loading" && (
        <div className={styles.skeletonList} aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
          <span className="visually-hidden" role="status">
            در حال بارگذاری...
          </span>
        </div>
      )}

      {state === "forbidden" && (
        <p className={styles.errorState} role="alert">
          مشاهده این بخش فقط برای مالک فروشگاه امکان‌پذیر است.
        </p>
      )}

      {state === "error" && (
        <p className={styles.errorState} role="alert">
          {errorMessage}
        </p>
      )}

      {state === "loaded" && entries.length === 0 && <p className={styles.emptyState}>هنوز فعالیتی ثبت نشده است.</p>}

      {state === "loaded" && entries.length > 0 && (
        <>
          <p className={styles.totalLabel}>{toPersianDigits(total)} رویداد</p>
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.action}>{actionLabel(entry.action)}</span>
                  <span className={styles.actor}>{entry.admin.fullName}</span>
                </div>
                <time className={styles.time} dateTime={entry.createdAt}>
                  {new Date(entry.createdAt).toLocaleString("fa-IR")}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
