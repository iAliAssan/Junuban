"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentCustomer, type AuthenticatedCustomer } from "@/lib/auth-client";
import { checkoutApi, CheckoutApiError, type OrderView } from "@/lib/checkout-client";
import { orderStatusLabel } from "@/lib/order-status-labels";
import { formatToman, toPersianDigits } from "@/lib/format";
import styles from "./orders-page.module.css";

const STATUS_CLASS_MAP: Record<string, keyof typeof styles> = {
  PENDING_PAYMENT: "statusPending",
  PAID: "statusPaid",
  PROCESSING: "statusProcessing",
  SHIPPED: "statusShipped",
  DELIVERED: "statusDelivered",
  CANCELLED: "statusCancelled",
  REFUNDED: "statusRefunded",
};

function statusClass(status: string): string {
  const key = STATUS_CLASS_MAP[status];
  return key ? (styles[key] ?? "") : "";
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
            <p>هنوز سفارشی ثبت نکرده‌اید.</p>
            <Link href="/products" className={styles.continueLink}>
              مشاهده محصولات ←
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
