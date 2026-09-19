"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  adminPackagingOptionsApi,
  AdminApiError,
  type AdminPackagingOption,
  type CreatePackagingOptionPayload,
} from "@/lib/admin-packaging-options-client";
import { Toast } from "@/components/admin/toast";
import { PlusIcon, CloseIcon } from "@/components/ui/icons";
import { formatToman, toPersianDigits } from "@/lib/format";
import styles from "@/components/admin/reference-data-page.module.css";

type LoadState = "loading" | "loaded" | "error";

interface FormState {
  name: string;
  priceDelta: string;
  sortOrder: string;
  isActive: boolean;
}

function emptyForm(): FormState {
  return { name: "", priceDelta: "0", sortOrder: "0", isActive: true };
}

function toFormState(option: AdminPackagingOption): FormState {
  return {
    name: option.name,
    priceDelta: String(option.priceDelta),
    sortOrder: String(option.sortOrder),
    isActive: option.isActive,
  };
}

const MAX_PRICE_DELTA = 1_000_000_000;

export function AdminPackagingOptionsPageClient() {
  const [options, setOptions] = useState<AdminPackagingOption[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function load() {
    setState("loading");
    setErrorMessage(null);
    adminPackagingOptionsApi
      .list()
      .then((items) => {
        setOptions(items);
        setState("loaded");
      })
      .catch((err) => {
        setErrorMessage(err instanceof AdminApiError ? err.message : "دریافت گزینه‌های بسته‌بندی با خطا مواجه شد");
        setState("error");
      });
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setPanelOpen(true);
  }

  function openEdit(option: AdminPackagingOption) {
    setEditingId(option.id);
    setForm(toFormState(option));
    setFormError(null);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError("نام گزینه بسته‌بندی الزامی است");
      return;
    }

    const priceDelta = Number(form.priceDelta);
    if (!Number.isInteger(priceDelta) || priceDelta < 0 || priceDelta > MAX_PRICE_DELTA) {
      setFormError(`هزینه اضافه باید عددی صحیح بین ۰ تا ${toPersianDigits(MAX_PRICE_DELTA)} تومان باشد`);
      return;
    }
    const sortOrder = Number(form.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError("ترتیب نمایش باید عددی صحیح نامنفی باشد");
      return;
    }

    const payload: CreatePackagingOptionPayload = {
      name: form.name.trim(),
      priceDelta,
      sortOrder,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      if (editingId) {
        await adminPackagingOptionsApi.update(editingId, payload);
        setToastMessage("گزینه بسته‌بندی به‌روزرسانی شد");
      } else {
        await adminPackagingOptionsApi.create(payload);
        setToastMessage("گزینه بسته‌بندی ایجاد شد");
      }
      setPanelOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof AdminApiError ? err.message : "ذخیره گزینه بسته‌بندی با خطا مواجه شد");
    } finally {
      setSaving(false);
    }
  }

  const panel =
    mounted && panelOpen
      ? createPortal(
          <>
            <div className={styles.panelScrim} onClick={closePanel} aria-hidden="true" />
            <div
              className={styles.panel}
              role="dialog"
              aria-modal="true"
              aria-label={editingId ? "ویرایش گزینه بسته‌بندی" : "گزینه بسته‌بندی جدید"}
            >
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>
                  {editingId ? "ویرایش گزینه بسته‌بندی" : "گزینه بسته‌بندی جدید"}
                </span>
                <button type="button" className={styles.iconButton} aria-label="بستن" onClick={closePanel}>
                  <CloseIcon />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className={styles.panelBody}>
                  {formError && (
                    <p className={styles.errorState} role="alert">
                      {formError}
                    </p>
                  )}

                  <label className={styles.field}>
                    نام (مثلاً «بسته‌بندی استاندارد» یا «جعبه هدیه»)
                    <input
                      className={styles.input}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      maxLength={120}
                    />
                  </label>

                  <label className={styles.field}>
                    هزینه اضافه (تومان)
                    <input
                      type="number"
                      min={0}
                      max={MAX_PRICE_DELTA}
                      step={1}
                      className={styles.input}
                      value={form.priceDelta}
                      onChange={(e) => setForm({ ...form, priceDelta: e.target.value })}
                    />
                    {form.priceDelta && !Number.isNaN(Number(form.priceDelta)) && (
                      <span className={styles.priceHint}>{formatToman(Number(form.priceDelta))}</span>
                    )}
                  </label>

                  <label className={styles.field}>
                    ترتیب نمایش
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className={styles.input}
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    />
                  </label>

                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    فعال (در سبد خرید و پرداخت قابل انتخاب است)
                  </label>
                </div>

                <div className={styles.panelFooter}>
                  <button type="button" className={styles.cancelButton} onClick={closePanel}>
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
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>گزینه‌های بسته‌بندی</h1>
        <button type="button" className={styles.newButton} onClick={openCreate}>
          <PlusIcon width={18} height={18} />
          گزینه جدید
        </button>
      </div>

      {state === "loading" && (
        <div className={styles.skeletonList} aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
          <span className="visually-hidden" role="status">
            در حال بارگذاری گزینه‌های بسته‌بندی...
          </span>
        </div>
      )}

      {state === "error" && (
        <p className={styles.errorState} role="alert">
          {errorMessage}
        </p>
      )}

      {state === "loaded" && options.length === 0 && (
        <p className={styles.emptyState}>
          هنوز گزینه بسته‌بندی‌ای ایجاد نشده است. بدون حداقل یک گزینه فعال، مشتریان در سبد خرید نمی‌توانند
          بسته‌بندی انتخاب کنند.
        </p>
      )}

      {state === "loaded" && options.length > 0 && (
        <>
          <p className={styles.totalLabel}>{toPersianDigits(options.length)} گزینه</p>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>نام</th>
                <th>هزینه اضافه</th>
                <th>ترتیب</th>
                <th>وضعیت</th>
                <th className="visually-hidden">ویرایش</th>
              </tr>
            </thead>
            <tbody>
              {options.map((option) => (
                <tr key={option.id}>
                  <td data-label="نام">
                    <button type="button" className={styles.nameLink} onClick={() => openEdit(option)}>
                      {option.name}
                    </button>
                  </td>
                  <td data-label="هزینه اضافه">
                    {option.priceDelta === 0 ? "رایگان" : formatToman(option.priceDelta)}
                  </td>
                  <td data-label="ترتیب">{toPersianDigits(option.sortOrder)}</td>
                  <td data-label="وضعیت">
                    <span className={`${styles.statusBadge} ${option.isActive ? styles.badgeActive : styles.badgeHidden}`}>
                      {option.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td data-label="">
                    <button type="button" className={styles.editLink} onClick={() => openEdit(option)}>
                      ویرایش
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {panel}
      <Toast message={toastMessage} tone="success" onDismiss={() => setToastMessage(null)} />
    </div>
  );
}
