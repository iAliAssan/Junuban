"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentCustomer, type AuthenticatedCustomer } from "@/lib/auth-client";
import { checkoutApi, CheckoutApiError, type OrderView } from "@/lib/checkout-client";
import { orderStatusLabel, orderStatusColorToken, type OrderStatusColorToken } from "@/lib/order-status-labels";
import { formatToman, toPersianDigits } from "@/lib/format";
import { ClipboardListIcon } from "@/components/ui/icons";
import styles from "./orders-page.module.css";

const COLOR_TOKEN_TO_CLASS: Record<OrderStatusColorToken, keyof typeof styles> = {
  pending: "statusPending",
  info: "statusPaid",
  success: "statusShipped",
  error: "statusCancelled",
};

function statusClass(status: string): string {
  return styles[COLOR_TOKEN_TO_CLASS[orderStatusColorToken(status)]] ?? "";
}

export function OrdersListClient() {
  const router = useRouter();
  const [customer, setCustomer] = useState<AuthenticatedCustomer | null | "loading">("loading");
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentCustomer().then((c) => {
      setCustomer(c);
      if (!c) {
        router.replace("/account/login?redirect=/orders");
        return;
      }
      checkoutApi
        .listMyOrders()
        .then(setOrders)
        .catch((err) => setLoadError(err instanceof CheckoutApiError ? err.message : "بارگذاری سفارش‌ها با خطا مواجه شد"));
    });
  }, [router]);

  if (customer === "loading" || (customer && orders === null && !loadError)) {
    return (
      <div className={styles.layout}>
        <div className="container">
          <p role="status">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (!customer) return null; // redirecting

  return (
    <div className={styles.layout}>
      <div className="container">
        <h1 className={styles.title}>سفارش‌های من</h1>

        {loadError && (
          <div className={styles.errorState} role="alert">
            <p>{loadError}</p>
          </div>
        )}

        {!loadError && orders && orders.length === 0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIconWrap} aria-hidden="true">
              <ClipboardListIcon width={28} height={28} />
            </span>
            <h2 className={styles.emptyTitle}>هنوز سفارشی ثبت نکرده‌اید</h2>
            <p className={styles.emptyBody}>
              وقتی خریدی انجام دهید، سفارش‌های شما همین‌جا نمایش داده می‌شود.
            </p>
            <Link href="/products" className={styles.emptyCta}>
              مشاهده محصولات
            </Link>
          </div>
        )}

        {!loadError &&
          orders &&
          orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`} className={styles.orderCard}>
              <div className={styles.orderCardTop}>
                <span className={styles.orderNumber}>{toPersianDigits(order.orderNumber)}</span>
                <span className={styles.orderDate}>
                  {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                </span>
              </div>
              <div className={styles.orderCardBottom}>
                <span className={`${styles.statusBadge} ${statusClass(order.status)}`}>
                  {orderStatusLabel(order.status)}
                </span>
                <span className={styles.orderTotal}>{formatToman(order.total)}</span>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}
