"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentCustomer, type AuthenticatedCustomer } from "@/lib/auth-client";
import { checkoutApi, CheckoutApiError, type OrderView } from "@/lib/checkout-client";
import { orderStatusLabel, paymentAttemptStatusLabel, paymentMethodLabel } from "@/lib/order-status-labels";
import { formatToman, toPersianDigits } from "@/lib/format";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import styles from "../orders-page.module.css";

// Mirrors OrdersService.cancelOrder's ALLOWED_TRANSITIONS check on the
// backend (order-status.util.ts) — cancellable from PENDING_PAYMENT or
// PAID. Duplicated client-side purely to decide whether to *show* the
// button; the backend re-validates regardless, so a stale/incorrect
// value here can never let an actually-invalid cancellation through,
// only (at worst) show a button that the API would then reject with a
// clear error.
const CANCELLABLE_STATUSES = new Set(["PENDING_PAYMENT", "PAID"]);

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<AuthenticatedCustomer | null | "loading">("loading");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentCustomer().then((c) => {
      setCustomer(c);
      if (!c) {
        router.replace(`/account/login?redirect=/orders/${orderId}`);
        return;
      }
      checkoutApi
        .getOrder(orderId)
        .then(setOrder)
        .catch((err) => {
          if (err instanceof CheckoutApiError && (err.status === 404 || err.status === 403)) {
            setNotFound(true);
          } else {
            setLoadError(err instanceof CheckoutApiError ? err.message : "بارگذاری سفارش با خطا مواجه شد");
          }
        });
    });
  }, [router, orderId]);

  if (customer === "loading" || (customer && !order && !loadError && !notFound)) {
    return (
      <div className={styles.layout}>
        <div className="container">
          <p role="status">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (!customer) return null; // redirecting

  if (notFound) {
    return (
      <div className={styles.layout}>
        <div className="container">
          <div className={styles.errorState} role="alert">
            <p>این سفارش یافت نشد یا متعلق به شما نیست.</p>
            <Link href="/orders" className={styles.continueLink}>
              بازگشت به سفارش‌ها ←
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.layout}>
        <div className="container">
          <div className={styles.errorState} role="alert">
            <p>{loadError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const canCancel = CANCELLABLE_STATUSES.has(order.status);

  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await checkoutApi.cancelOrder(orderId);
      setOrder(updated);
      setCancelDialogOpen(false);
    } catch (err) {
      setCancelError(err instanceof CheckoutApiError ? err.message : "لغو سفارش با خطا مواجه شد");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div className="container">
        <Link href="/orders" className={styles.backLink}>
          ← بازگشت به سفارش‌ها
        </Link>
        <h1 className={styles.title}>سفارش {toPersianDigits(order.orderNumber)}</h1>

        <div className={styles.detailGrid}>
          <div>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>کالاها</h2>
              {order.items.map((item) => (
                <div key={item.id} className={styles.itemGroup}>
                  <div className={styles.itemRow}>
                    <div className={styles.itemInfo}>
                      <p>{item.productNameSnapshot}</p>
                      <p className={styles.itemMeta}>
                        {item.producerNameSnapshot} — {item.weightLabelSnapshot} × {toPersianDigits(item.quantity)}
                      </p>
                    </div>
                    <span>{formatToman(item.unitPriceSnapshot * item.quantity)}</span>
                  </div>
                  {item.packagingNameSnapshot && (
                    <div className={styles.itemRow}>
                      <div className={styles.itemInfo}>
                        <p className={styles.itemMeta}>
                          {item.packagingNameSnapshot} × {toPersianDigits(item.quantity)}
                        </p>
                      </div>
                      <span>{formatToman(item.packagingPriceSnapshot * item.quantity)}</span>
                    </div>
                  )}
                </div>
              ))}
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>آدرس تحویل</h2>
              <p className={styles.addressText}>
                {order.shippingAddress.recipientName} — {order.shippingAddress.phone}
                <br />
                {order.shippingAddress.province}، {order.shippingAddress.city}
                <br />
                {order.shippingAddress.addressLine}
                <br />
                کد پستی: {toPersianDigits(order.shippingAddress.postalCode)}
              </p>
            </section>

            {order.customerNote && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>توضیحات سفارش</h2>
                <p className={styles.addressText}>{order.customerNote}</p>
              </section>
            )}

            {order.paymentAttempts.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>وضعیت پرداخت</h2>
                {order.paymentAttempts.map((attempt) => (
                  <div key={attempt.id} className={styles.itemRow}>
                    <span>{paymentMethodLabel(attempt.method)}</span>
                    <span>{paymentAttemptStatusLabel(attempt.status)}</span>
                  </div>
                ))}
              </section>
            )}
          </div>

          <aside className={styles.section}>
            <h2 className={styles.sectionTitle}>خلاصه سفارش</h2>
            <p className={styles.itemMeta}>
              تاریخ ثبت: {new Date(order.createdAt).toLocaleDateString("fa-IR")}
            </p>
            <div className={styles.summaryRow}>
              <span>وضعیت سفارش</span>
              <span>{orderStatusLabel(order.status)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>جمع کالاها</span>
              <span>{formatToman(order.subtotal)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>هزینه ارسال</span>
              <span>{order.shippingCost === 0 ? "رایگان" : formatToman(order.shippingCost)}</span>
            </div>
            <div className={styles.summaryTotalRow}>
              <span>مجموع</span>
              <span>{formatToman(order.total)}</span>
            </div>

            {canCancel && (
              <>
                {cancelError && (
                  <p className={styles.cancelError} role="alert">
                    {cancelError}
                  </p>
                )}
                <button
                  type="button"
                  className={styles.cancelOrderButton}
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={cancelling}
                >
                  لغو سفارش
                </button>
              </>
            )}
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={cancelDialogOpen}
        title="لغو این سفارش؟"
        description="پس از لغو، امکان بازگشت وجود ندارد. در صورت پرداخت‌شدن سفارش، مبلغ طبق سیاست بازگشت وجه پردازش خواهد شد."
        confirmLabel="لغو سفارش"
        destructive
        pending={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setCancelDialogOpen(false)}
      />
    </div>
  );
}
