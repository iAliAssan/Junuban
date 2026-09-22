"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentCustomer, type AuthenticatedCustomer } from "@/lib/auth-client";
import { addressApi, AddressApiError, type AddressView, type AddressInput } from "@/lib/addresses-client";
import { validateShippingAddress, hasErrors, type CheckoutFieldErrors } from "@/lib/checkout-validation";
import { AddressFormFields, type AddressFormValues } from "@/components/address-form/address-form-fields";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { PlusIcon, CloseIcon } from "@/components/ui/icons";
import styles from "./addresses-page.module.css";

function emptyForm(): AddressFormValues {
  return { recipientName: "", phone: "", province: "", city: "", addressLine: "", postalCode: "" };
}

function toFormValues(a: AddressView): AddressFormValues {
  return {
    recipientName: a.recipientName,
    phone: a.phone,
    province: a.province,
    city: a.city,
    addressLine: a.addressLine,
    postalCode: a.postalCode,
  };
}

export function AddressesPageClient() {
  const router = useRouter();
  const [customer, setCustomer] = useState<AuthenticatedCustomer | null | "loading">("loading");
  const [addresses, setAddresses] = useState<AddressView[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormValues>(emptyForm());
  const [makeDefault, setMakeDefault] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function load() {
    setLoadState("loading");
    setLoadError(null);
    addressApi
      .list()
      .then((items) => {
        setAddresses(items);
        setLoadState("loaded");
      })
      .catch((err) => {
        setLoadError(err instanceof AddressApiError ? err.message : "دریافت آدرس‌ها با خطا مواجه شد");
        setLoadState("error");
      });
  }

  useEffect(() => {
    getCurrentCustomer().then((c) => {
      setCustomer(c);
      if (!c) {
        router.replace("/account/login?redirect=/account/addresses");
        return;
      }
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (customer === "loading" || !customer) {
    return (
      <div className={styles.layout}>
        <div className="container">
          <p role="status">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setMakeDefault(addresses.length === 0); // the very first address is sensibly the default
    setFieldErrors({});
    setSaveError(null);
    setPanelOpen(true);
  }

  function openEdit(address: AddressView) {
    setEditingId(address.id);
    setForm(toFormValues(address));
    setMakeDefault(address.isDefault);
    setFieldErrors({});
    setSaveError(null);
    setPanelOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateShippingAddress(form);
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSaving(true);
    setSaveError(null);
    const payload: AddressInput = { ...form, isDefault: makeDefault };
    try {
      if (editingId) {
        await addressApi.update(editingId, payload);
      } else {
        await addressApi.create(payload);
      }
      setPanelOpen(false);
      load();
    } catch (err) {
      setSaveError(err instanceof AddressApiError ? err.message : "ذخیره آدرس با خطا مواجه شد");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDeleteId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await addressApi.remove(pendingDeleteId);
      setPendingDeleteId(null);
      load();
    } catch (err) {
      setDeleteError(err instanceof AddressApiError ? err.message : "حذف آدرس با خطا مواجه شد");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSetDefault(address: AddressView) {
    if (address.isDefault || settingDefaultId) return;
    setSettingDefaultId(address.id);
    try {
      await addressApi.update(address.id, { isDefault: true });
      load();
    } catch {
      // Non-critical action — list simply won't reflect the change; the
      // person can retry. No separate error UI to avoid over-alerting
      // for a low-stakes action they can just click again.
    } finally {
      setSettingDefaultId(null);
    }
  }

  const panel =
    mounted && panelOpen
      ? createPortal(
          <>
            <div className={styles.panelScrim} onClick={() => setPanelOpen(false)} aria-hidden="true" />
            <div
              className={styles.panel}
              role="dialog"
              aria-modal="true"
              aria-label={editingId ? "ویرایش آدرس" : "آدرس جدید"}
            >
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>{editingId ? "ویرایش آدرس" : "آدرس جدید"}</span>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="بستن"
                  onClick={() => setPanelOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className={styles.panelBody}>
                  {saveError && (
                    <p className={styles.formError} role="alert">
                      {saveError}
                    </p>
                  )}
                  <AddressFormFields value={form} onChange={setForm} errors={fieldErrors} idPrefix="addr-" />
                  <label className={styles.defaultCheckboxField}>
                    <input
                      type="checkbox"
                      checked={makeDefault}
                      onChange={(e) => setMakeDefault(e.target.checked)}
                      disabled={editingId !== null && addresses.find((a) => a.id === editingId)?.isDefault}
                    />
                    <span>آدرس پیش‌فرض</span>
                  </label>
                </div>
                <div className={styles.panelFooter}>
                  <button type="button" className={styles.cancelButton} onClick={() => setPanelOpen(false)}>
                    انصراف
                  </button>
                  <button type="submit" className={styles.saveButton} disabled={saving}>
                    {saving ? "در حال ذخیره..." : "ذخیره"}
                  </button>
                </div>
              </form>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className={styles.layout}>
      <div className="container">
        <Link href="/account" className={styles.backLink}>
          ← بازگشت به حساب کاربری
        </Link>

        <div className={styles.header}>
          <h1 className={styles.title}>آدرس‌های من</h1>
          <button type="button" className={styles.addButton} onClick={openCreate}>
            <PlusIcon width={18} height={18} />
            آدرس جدید
          </button>
        </div>

        {loadState === "loading" && <p role="status">در حال بارگذاری...</p>}

        {loadState === "error" && <p className={styles.errorState}>{loadError}</p>}

        {loadState === "loaded" && addresses.length === 0 && (
          <p className={styles.emptyState}>هنوز آدرسی ثبت نکرده‌اید. برای شروع، یک آدرس جدید اضافه کنید.</p>
        )}

        {loadState === "loaded" && addresses.length > 0 && (
          <div className={styles.list}>
            {deleteError && <p className={styles.errorState}>{deleteError}</p>}
            {addresses.map((address) => (
              <div key={address.id} className={styles.addressCard}>
                <div className={styles.addressCardTop}>
                  <span className={styles.recipientName}>{address.recipientName}</span>
                  {address.isDefault && <span className={styles.defaultBadge}>پیش‌فرض</span>}
                </div>
                <p className={styles.addressText}>
                  {address.province}، {address.city}، {address.addressLine}
                </p>
                <p className={styles.phoneText}>{address.phone}</p>
                <div className={styles.cardActions}>
                  <button type="button" className={styles.actionButton} onClick={() => openEdit(address)}>
                    ویرایش
                  </button>
                  {!address.isDefault && (
                    <button
                      type="button"
                      className={styles.actionButton}
                      onClick={() => handleSetDefault(address)}
                      disabled={settingDefaultId === address.id}
                    >
                      {settingDefaultId === address.id ? "در حال تنظیم..." : "تنظیم به‌عنوان پیش‌فرض"}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.actionButtonDestructive}
                    onClick={() => setPendingDeleteId(address.id)}
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {panel}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="حذف این آدرس؟"
        description="این عملیات قابل بازگشت نیست."
        confirmLabel="حذف آدرس"
        destructive
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
