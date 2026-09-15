"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, AdminApiError, type AdminOrderView, type OrderStatusFilter } from "@/lib/admin-orders-client";
import { orderStatusLabel } from "@/lib/order-status-labels";
import { formatToman, toPersianDigits } from "@/lib/format";
import styles from "./admin-orders-page.module.css";

const STATUS_FILTERS: { value: OrderStatusFilter | "ALL"; label: string }[] = [
  { value: "ALL", label: "همه" },
  { value: "PENDING_PAYMENT", label: "در انتظار پرداخت" },
  { value: "PAID", label: "پرداخت‌شده" },
  { value: "PROCESSING", label: "در حال آماده‌سازی" },
  { value: "SHIPPED", label: "ارسال‌شده" },
  { value: "DELIVERED", label: "تحویل داده‌شده" },
  { value: "CANCELLED", label: "لغوشده" },
  { value: "REFUNDED", label: "بازگردانده‌شده" },
];

type LoadState = "loading" | "loaded" | "error";

export function AdminOrdersPageClient() {
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter | "ALL">("ALL");
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setErrorMessage(null);

    adminApi
      .listOrders({ page: 1, pageSize: 50, status: statusFilter === "ALL" ? undefined : statusFilter })
      .then((res) => {
        if (cancelled) return;
        setOrders(res.items);
        setTotal(res.total);
        setState("loaded");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof AdminApiError ? err.message : "دریافت سفارش‌ها با خطا مواجه شد");
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  return (
    <div>
      <h1 className={styles.title}>سفارش‌ها</h1>

      <div className={styles.filters} role="group" aria-label="فیلتر وضعیت سفارش">
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

      {state === "loading" && (
        <div className={styles.skeletonList} aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
          <span className="visually-hidden" role="status">
            در حال بارگذاری سفارش‌ها...
          </span>
        </div>
      )}

      {state === "error" && (
        <p className={styles.errorState} role="alert">
          {errorMessage}
        </p>
      )}

      {state === "loaded" && orders.length === 0 && (
        <p className={styles.emptyState}>سفارشی با این وضعیت یافت نشد.</p>
      )}

      {state === "loaded" && orders.length > 0 && (
        <>
          <p className={styles.totalLabel}>{toPersianDigits(total)} سفارش</p>

          {/* Table on tablet/desktop, stacked cards on mobile — same
              "real responsive solution, not overflow-x hidden" rule
              the storefront's product filters follow. */}
          <table className={styles.table}>
            <thead>
              <tr>
                <th>شماره سفارش</th>
                <th>تاریخ</th>
                <th>وضعیت</th>
                <th>مبلغ</th>
                <th className="visually-hidden">جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td data-label="شماره سفارش">{order.orderNumber}</td>
                  <td data-label="تاریخ">{new Date(order.createdAt).toLocaleDateString("fa-IR")}</td>
                  <td data-label="وضعیت">
                    <span className={styles.statusBadge}>{orderStatusLabel(order.status)}</span>
                  </td>
                  <td data-label="مبلغ">{formatToman(order.total)}</td>
                  <td data-label="">
                    <Link href={`/admin/orders/${order.id}`} className={styles.detailLink}>
                      مشاهده
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
