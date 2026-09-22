"use client";

import { useEffect, useState } from "react";
import {
  adminSettingsApi,
  AdminApiError,
  type AdminPaymentSettings,
  type UpdatePaymentSettingsPayload,
} from "@/lib/admin-settings-client";
import { Toast } from "@/components/admin/toast";
import styles from "@/components/admin/reference-data-page.module.css";
import pageStyles from "./payment-settings-page.module.css";

interface FormState {
  cardToCardNumber: string;
  cardToCardHolderName: string;
  cardToCardBankName: string;
  shebaIban: string;
  shebaHolderName: string;
  paymentInstructions: string;
  photoUrl: string;
  photoAltText: string;
}

function emptyForm(): FormState {
  return {
    cardToCardNumber: "",
    cardToCardHolderName: "",
    cardToCardBankName: "",
    shebaIban: "",
    shebaHolderName: "",
    paymentInstructions: "",
    photoUrl: "",
    photoAltText: "",
  };
}

function toFormState(settings: AdminPaymentSettings): FormState {
  return {
    cardToCardNumber: settings.cardToCardNumber ?? "",
    cardToCardHolderName: settings.cardToCardHolderName ?? "",
    cardToCardBankName: settings.cardToCardBankName ?? "",
    shebaIban: settings.shebaIban ?? "",
    shebaHolderName: settings.shebaHolderName ?? "",
    paymentInstructions: settings.paymentInstructions ?? "",
    photoUrl: settings.paymentCardPhoto?.url ?? "",
    photoAltText: settings.paymentCardPhoto?.altText ?? "",
  };
}

export function AdminPaymentSettingsPageClient() {
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [hadPhotoOnLoad, setHadPhotoOnLoad] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    adminSettingsApi
      .getPaymentSettings()
      .then((settings) => {
        setForm(toFormState(settings));
        setHadPhotoOnLoad(settings.paymentCardPhoto !== null);
        setLoadState("loaded");
      })
      .catch((err) => {
        setLoadError(err instanceof AdminApiError ? err.message : "دریافت تنظیمات با خطا مواجه شد");
        setLoadState("error");
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    const cardNumberDigits = form.cardToCardNumber.replace(/[\s-]/g, "");
    if (cardNumberDigits && !/^\d{16,19}$/.test(cardNumberDigits)) {
      setSaveError("شماره کارت باید بین ۱۶ تا ۱۹ رقم باشد");
      return;
    }
    const shebaDigits = form.shebaIban.replace(/\s/g, "").toUpperCase();
    if (shebaDigits && !/^IR\d{24}$/.test(shebaDigits)) {
      setSaveError("شماره شبا معتبر نیست (باید با IR شروع شود و ۲۴ رقم داشته باشد)");
      return;
    }

    const photoUrl = form.photoUrl.trim();
    const photoAltText = form.photoAltText.trim();
    if (Boolean(photoUrl) !== Boolean(photoAltText)) {
      setSaveError("برای تصویر کارت، هم آدرس و هم متن جایگزین لازم است (یا هر دو خالی بمانند)");
      return;
    }
    if (photoUrl) {
      try {
        if (!["http:", "https:"].includes(new URL(photoUrl).protocol)) throw new Error();
      } catch {
        setSaveError("آدرس تصویر معتبر نیست (باید با http:// یا https:// شروع شود)");
        return;
      }
    }

    const photoObject = photoUrl && photoAltText ? { url: photoUrl, altText: photoAltText } : undefined;

    const payload: UpdatePaymentSettingsPayload = {
      cardToCardNumber: cardNumberDigits || undefined,
      cardToCardHolderName: form.cardToCardHolderName.trim() || undefined,
      cardToCardBankName: form.cardToCardBankName.trim() || undefined,
      shebaIban: shebaDigits || undefined,
      shebaHolderName: form.shebaHolderName.trim() || undefined,
      paymentInstructions: form.paymentInstructions.trim() || undefined,
      paymentCardPhoto: photoObject ?? (hadPhotoOnLoad ? null : undefined),
    };

    setSaving(true);
    try {
      const updated = await adminSettingsApi.updatePaymentSettings(payload);
      setForm(toFormState(updated));
      setHadPhotoOnLoad(updated.paymentCardPhoto !== null);
      setToastMessage("تنظیمات پرداخت ذخیره شد");
    } catch (err) {
      setSaveError(err instanceof AdminApiError ? err.message : "ذخیره تنظیمات با خطا مواجه شد");
    } finally {
      setSaving(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div>
        <h1 className={styles.title}>تنظیمات پرداخت</h1>
        <div className={styles.skeletonList} aria-hidden="true">
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
        </div>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div>
        <h1 className={styles.title}>تنظیمات پرداخت</h1>
        <p className={styles.errorState} role="alert">
          {loadError}
        </p>
      </div>
    );
  }

  return (
    <div className={pageStyles.layout}>
      <h1 className={styles.title}>تنظیمات پرداخت</h1>
      <p className={pageStyles.subtitle}>
        این اطلاعات هنگام پرداخت کارت‌به‌کارت یا شبا به مشتریان نمایش داده می‌شود.
      </p>

      <form onSubmit={handleSubmit} className={pageStyles.form}>
        {saveError && (
          <p className={styles.errorState} role="alert">
            {saveError}
          </p>
        )}

        <section className={pageStyles.section}>
          <h2 className={pageStyles.sectionTitle}>کارت به کارت</h2>

          <label className={styles.field}>
            شماره کارت
            <input
              className={styles.input}
              value={form.cardToCardNumber}
              onChange={(e) => setForm({ ...form, cardToCardNumber: e.target.value })}
              placeholder="6037-XXXX-XXXX-XXXX"
              inputMode="numeric"
              dir="ltr"
              maxLength={24}
            />
          </label>

          <label className={styles.field}>
            نام صاحب حساب
            <input
              className={styles.input}
              value={form.cardToCardHolderName}
              onChange={(e) => setForm({ ...form, cardToCardHolderName: e.target.value })}
              maxLength={120}
            />
          </label>

          <label className={styles.field}>
            نام بانک (اختیاری)
            <input
              className={styles.input}
              value={form.cardToCardBankName}
              onChange={(e) => setForm({ ...form, cardToCardBankName: e.target.value })}
              maxLength={80}
            />
          </label>

          <label className={styles.field}>
            آدرس تصویر کارت (اختیاری)
            <input
              className={styles.input}
              value={form.photoUrl}
              onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              placeholder="https://..."
              maxLength={2048}
              dir="ltr"
            />
          </label>

          {form.photoUrl.trim() && (
            <label className={styles.field}>
              متن جایگزین تصویر
              <input
                className={styles.input}
                value={form.photoAltText}
                onChange={(e) => setForm({ ...form, photoAltText: e.target.value })}
                maxLength={300}
                required
              />
            </label>
          )}
        </section>

        <section className={pageStyles.section}>
          <h2 className={pageStyles.sectionTitle}>شبا</h2>

          <label className={styles.field}>
            شماره شبا
            <input
              className={styles.input}
              value={form.shebaIban}
              onChange={(e) => setForm({ ...form, shebaIban: e.target.value })}
              placeholder="IR820540102680020817909002"
              dir="ltr"
              maxLength={30}
            />
          </label>

          <label className={styles.field}>
            نام صاحب حساب
            <input
              className={styles.input}
              value={form.shebaHolderName}
              onChange={(e) => setForm({ ...form, shebaHolderName: e.target.value })}
              maxLength={120}
            />
          </label>
        </section>

        <section className={pageStyles.section}>
          <h2 className={pageStyles.sectionTitle}>توضیحات تکمیلی</h2>
          <label className={styles.field}>
            یادداشت برای مشتری (اختیاری)
            <textarea
              className={styles.textarea}
              rows={4}
              value={form.paymentInstructions}
              onChange={(e) => setForm({ ...form, paymentInstructions: e.target.value })}
              maxLength={2000}
              placeholder="مثلاً: پس از واریز، رسید را از طریق واتس‌اپ ارسال کنید."
            />
          </label>
        </section>

        <button type="submit" className={styles.saveButton} disabled={saving}>
          {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
        </button>
      </form>

      <Toast message={toastMessage} tone="success" onDismiss={() => setToastMessage(null)} />
    </div>
  );
}
