"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/cart-provider";
import { checkoutApi, CheckoutApiError, type CheckoutResponse, type ShippingAddressInput } from "@/lib/checkout-client";
import { getCurrentCustomer, type AuthenticatedCustomer } from "@/lib/auth-client";
import { validateShippingAddress, validateGuestPhone, hasErrors, type CheckoutFieldErrors } from "@/lib/checkout-validation";
import { formatToman, toPersianDigits } from "@/lib/format";
import styles from "./checkout-page.module.css";

const EMPTY_ADDRESS: ShippingAddressInput = {
  recipientName: "",
  phone: "",
  province: "",
  city: "",
  addressLine: "",
  postalCode: "",
};

function generateIdempotencyKey(): string {
  // crypto.randomUUID is available in all evergreen browsers; a Math.random
  // fallback is fine here since this key only needs to be unique per
  // checkout attempt, not cryptographically unguessable.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CheckoutPageClient() {
  const { cart, status: cartStatus, refresh: refreshCart } = useCart();

  const [customer, setCustomer] = useState<AuthenticatedCustomer | null | "loading">("loading");
  const [address, setAddress] = useState<ShippingAddressInput>(EMPTY_ADDRESS);
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CARD_TO_CARD" | "SHEBA">("CARD_TO_CARD");
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<CheckoutResponse | null>(null);
  const [idempotencyKey] = useState(generateIdempotencyKey);

  useEffect(() => {
    getCurrentCustomer().then(setCustomer);
  }, []);

  const isAuthenticated = customer !== null && customer !== "loading";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // prevent double-submission from a double click

    const addressErrors = validateShippingAddress(address);
    const guestErrors = validateGuestPhone(guestPhone, isAuthenticated);
    const errors = { ...addressErrors, ...guestErrors };
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await checkoutApi.submit({
        shippingAddress: address,
        paymentMethod,
        guestPhone: isAuthenticated ? undefined : guestPhone,
        guestEmail: isAuthenticated ? undefined : guestEmail || undefined,
        idempotencyKey,
      });
      setConfirmed(response);
      refreshCart(); // the server already cleared the cart — sync the header badge
    } catch (err) {
      setSubmitError(err instanceof CheckoutApiError ? err.message : "ثبت سفارش با خطا مواجه شد");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Confirmation (shown regardless of current cart state) ----
  if (confirmed) {
    return (
      <div className={styles.layout}>
        <div className="container">
          <div className={styles.confirmation}>
            <span className={styles.pendingBadge}>در انتظار تایید پرداخت</span>
            <h1 className={styles.confirmationTitle}>سفارش شما ثبت شد</h1>
            <p className={styles.orderNumber}>شماره سفارش: {toPersianDigits(confirmed.order.orderNumber)}</p>

            <div className={styles.confirmationTotals}>
              <div className={styles.summaryRow}>
                <span>جمع کالاها</span>
                <span>{formatToman(confirmed.order.subtotal)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>هزینه ارسال</span>
                <span>{confirmed.order.shippingCost === 0 ? "رایگان" : formatToman(confirmed.order.shippingCost)}</span>
              </div>
              <div className={styles.summaryTotalRow}>
                <span>مبلغ قابل پرداخت</span>
                <span>{formatToman(confirmed.order.total)}</span>
              </div>
            </div>

            {confirmed.paymentInstructions && (
              <p className={styles.paymentInstructions}>{confirmed.paymentInstructions}</p>
            )}
            <p>
              پس از واریز وجه، سفارش شما توسط تیم جنوبان بررسی و تایید می‌شود. این فرآیند به‌صورت دستی انجام
              می‌شود و ممکن است کمی زمان ببرد.
            </p>
            <Link href="/products" className={styles.continueLink}>
              بازگشت به فروشگاه ←
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Loading ----
  if (cartStatus === "loading" && !cart) {
    return (
      <div className={styles.layout}>
        <div className="container">
          <p role="status">در حال بارگذاری سبد خرید...</p>
        </div>
      </div>
    );
  }

  // ---- Cart error (genuine load failure, never confused with "empty") ----
  if (cartStatus === "error") {
    return (
      <div className={styles.layout}>
        <div className="container">
          <div className={styles.errorState} role="alert">
            <p>سبد خرید شما بارگذاری نشد. لطفاً صفحه را دوباره بارگذاری کنید.</p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Empty cart: a normal state, not an error, but checkout needs items ----
  if (cart && cart.items.length === 0) {
    return (
      <div className={styles.layout}>
        <div className="container">
          <div className={styles.emptyState}>
            <p>سبد خرید شما خالی است. برای تکمیل خرید، ابتدا کالایی به سبد خود اضافه کنید.</p>
            <Link href="/products" className={styles.continueLink}>
              مشاهده محصولات ←
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!cart) return null;

  return (
    <div className={styles.layout}>
      <div className="container">
        <h1 className={styles.title}>تکمیل خرید</h1>

        <form className={styles.grid} onSubmit={handleSubmit} noValidate>
          <div>
            {!isAuthenticated && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>اطلاعات تماس مهمان</h2>
                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <label htmlFor="guest-phone">شماره موبایل</label>
                    <input
                      id="guest-phone"
                      type="tel"
                      autoComplete="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      aria-invalid={Boolean(fieldErrors.guestPhone)}
                      aria-describedby={fieldErrors.guestPhone ? "guest-phone-error" : undefined}
                    />
                    {fieldErrors.guestPhone && (
                      <span id="guest-phone-error" className={styles.fieldError} role="alert">
                        {fieldErrors.guestPhone}
                      </span>
                    )}
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="guest-email">ایمیل (اختیاری)</label>
                    <input
                      id="guest-email"
                      type="email"
                      autoComplete="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                    />
                  </div>
                </div>
              </section>
            )}

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>آدرس تحویل سفارش</h2>
              <div className={styles.fieldGrid}>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label htmlFor="recipientName">نام گیرنده</label>
                  <input
                    id="recipientName"
                    autoComplete="name"
                    value={address.recipientName}
                    onChange={(e) => setAddress({ ...address, recipientName: e.target.value })}
                    aria-invalid={Boolean(fieldErrors.recipientName)}
                    aria-describedby={fieldErrors.recipientName ? "recipientName-error" : undefined}
                  />
                  {fieldErrors.recipientName && (
                    <span id="recipientName-error" className={styles.fieldError} role="alert">
                      {fieldErrors.recipientName}
                    </span>
                  )}
                </div>

                <div className={styles.field}>
                  <label htmlFor="phone">شماره تماس</label>
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={address.phone}
                    onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                  />
                  {fieldErrors.phone && (
                    <span id="phone-error" className={styles.fieldError} role="alert">
                      {fieldErrors.phone}
                    </span>
                  )}
                </div>

                <div className={styles.field}>
                  <label htmlFor="postalCode">کد پستی</label>
                  <input
                    id="postalCode"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={address.postalCode}
                    onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                    aria-invalid={Boolean(fieldErrors.postalCode)}
                    aria-describedby={fieldErrors.postalCode ? "postalCode-error" : undefined}
                  />
                  {fieldErrors.postalCode && (
                    <span id="postalCode-error" className={styles.fieldError} role="alert">
                      {fieldErrors.postalCode}
                    </span>
                  )}
                </div>

                <div className={styles.field}>
                  <label htmlFor="province">استان</label>
                  <input
                    id="province"
                    autoComplete="address-level1"
                    value={address.province}
                    onChange={(e) => setAddress({ ...address, province: e.target.value })}
                    aria-invalid={Boolean(fieldErrors.province)}
                    aria-describedby={fieldErrors.province ? "province-error" : undefined}
                  />
                  {fieldErrors.province && (
                    <span id="province-error" className={styles.fieldError} role="alert">
                      {fieldErrors.province}
                    </span>
                  )}
                </div>

                <div className={styles.field}>
                  <label htmlFor="city">شهر</label>
                  <input
                    id="city"
                    autoComplete="address-level2"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    aria-invalid={Boolean(fieldErrors.city)}
                    aria-describedby={fieldErrors.city ? "city-error" : undefined}
                  />
                  {fieldErrors.city && (
                    <span id="city-error" className={styles.fieldError} role="alert">
                      {fieldErrors.city}
                    </span>
                  )}
                </div>

                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label htmlFor="addressLine">آدرس کامل</label>
                  <input
                    id="addressLine"
                    autoComplete="street-address"
                    value={address.addressLine}
                    onChange={(e) => setAddress({ ...address, addressLine: e.target.value })}
                    aria-invalid={Boolean(fieldErrors.addressLine)}
                    aria-describedby={fieldErrors.addressLine ? "addressLine-error" : undefined}
                  />
                  {fieldErrors.addressLine && (
                    <span id="addressLine-error" className={styles.fieldError} role="alert">
                      {fieldErrors.addressLine}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>روش پرداخت</h2>
              <div className={styles.paymentOptions} role="radiogroup" aria-label="روش پرداخت">
                <label className={styles.paymentOption}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === "CARD_TO_CARD"}
                    onChange={() => setPaymentMethod("CARD_TO_CARD")}
                  />
                  <span className={styles.paymentOptionLabel}>کارت به کارت</span>
                </label>
                <label className={styles.paymentOption}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === "SHEBA"}
                    onChange={() => setPaymentMethod("SHEBA")}
                  />
                  <span className={styles.paymentOptionLabel}>انتقال شبا</span>
                </label>
              </div>
            </section>

            {submitError && (
              <p className={styles.formError} role="alert">
                {submitError}
              </p>
            )}
          </div>

          <aside className={styles.summaryCard}>
            <h2 className={styles.sectionTitle}>خلاصه سفارش</h2>
            {cart.items.map((item) => (
              <div key={item.id} className={styles.summaryItem}>
                <span className={styles.summaryItemName}>
                  {item.productName} × {toPersianDigits(item.quantity)}
                </span>
                <span>{formatToman(item.lineTotal)}</span>
              </div>
            ))}
            <div className={styles.summaryRow}>
              <span>جمع کالاها</span>
              <span>{formatToman(cart.subtotal)}</span>
            </div>
            <p className={styles.shippingNote}>
              هزینه ارسال پس از ثبت سفارش محاسبه و به مبلغ نهایی اضافه می‌شود.
            </p>

            <button type="submit" className={styles.submitButton} disabled={submitting}>
              {submitting ? "در حال ثبت سفارش..." : "ثبت سفارش"}
            </button>
          </aside>
        </form>
      </div>
    </div>
  );
}
