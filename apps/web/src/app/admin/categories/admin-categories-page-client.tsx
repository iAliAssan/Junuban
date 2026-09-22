"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  adminCategoriesApi,
  AdminApiError,
  type AdminCategory,
  type AdminCategoryStatus,
  type CreateCategoryPayload,
  type UpdateCategoryPayload,
} from "@/lib/admin-categories-client";
import { Toast } from "@/components/admin/toast";
import { PlusIcon, CloseIcon } from "@/components/ui/icons";
import { toPersianDigits } from "@/lib/format";
import styles from "@/components/admin/reference-data-page.module.css";

const STATUS_LABEL: Record<AdminCategoryStatus, string> = {
  ACTIVE: "فعال",
  HIDDEN: "پنهان",
};

type LoadState = "loading" | "loaded" | "error";

interface FormState {
  slug: string;
  name: string;
  iconKey: string;
  sortOrder: string;
  status: AdminCategoryStatus;
  photoUrl: string;
  photoAltText: string;
}

function emptyForm(): FormState {
  return { slug: "", name: "", iconKey: "", sortOrder: "0", status: "ACTIVE", photoUrl: "", photoAltText: "" };
}

function toFormState(category: AdminCategory): FormState {
  return {
    slug: category.slug,
    name: category.name,
    iconKey: category.iconKey ?? "",
    sortOrder: String(category.sortOrder),
    status: category.status,
    photoUrl: category.photo?.url ?? "",
    photoAltText: category.photo?.altText ?? "",
  };
}

export function AdminCategoriesPageClient() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hadPhotoOnOpen, setHadPhotoOnOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function load() {
    setState("loading");
    setErrorMessage(null);
    adminCategoriesApi
      .list()
      .then((res) => {
        setCategories(res.items);
        setState("loaded");
      })
      .catch((err) => {
        setErrorMessage(err instanceof AdminApiError ? err.message : "دریافت دسته‌بندی‌ها با خطا مواجه شد");
        setState("error");
      });
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setHadPhotoOnOpen(false);
    setFormError(null);
    setPanelOpen(true);
  }

  function openEdit(category: AdminCategory) {
    setEditingId(category.id);
    setForm(toFormState(category));
    setHadPhotoOnOpen(category.photo !== null);
    setFormError(null);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const sortOrderNum = Number(form.sortOrder);
    if (!form.slug.trim() || !form.name.trim()) {
      setFormError("شناسه (slug) و نام الزامی هستند");
      return;
    }
    if (Number.isNaN(sortOrderNum) || sortOrderNum < 0) {
      setFormError("ترتیب نمایش باید عددی نامنفی باشد");
      return;
    }

    const photoUrl = form.photoUrl.trim();
    const photoAltText = form.photoAltText.trim();
    if (Boolean(photoUrl) !== Boolean(photoAltText)) {
      setFormError("برای تصویر دسته‌بندی، هم آدرس و هم متن جایگزین لازم است (یا هر دو خالی بمانند)");
      return;
    }
    if (photoUrl) {
      try {
        if (!["http:", "https:"].includes(new URL(photoUrl).protocol)) throw new Error();
      } catch {
        setFormError("آدرس تصویر معتبر نیست (باید با http:// یا https:// شروع شود)");
        return;
      }
    }

    // Same three-state contract as the producer form (see
    // admin-producers-page-client.tsx and SinglePhotoInputDto's doc
    // comment): both fields filled → upsert; both empty AND there was a
    // photo before → explicit removal (update-only, `hadPhotoOnOpen` is
    // always false on create); both empty and never had one → omit.
    const photoObject = photoUrl && photoAltText ? { url: photoUrl, altText: photoAltText } : undefined;

    const basePayload = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      iconKey: form.iconKey.trim() || undefined,
      sortOrder: sortOrderNum,
      status: form.status,
    };

    setSaving(true);
    try {
      if (editingId) {
        const updatePayload: UpdateCategoryPayload = {
          ...basePayload,
          photo: photoObject ?? (hadPhotoOnOpen ? null : undefined),
        };
        await adminCategoriesApi.update(editingId, updatePayload);
        setToastMessage("دسته‌بندی به‌روزرسانی شد");
      } else {
        const createPayload: CreateCategoryPayload = { ...basePayload, photo: photoObject };
        await adminCategoriesApi.create(createPayload);
        setToastMessage("دسته‌بندی ایجاد شد");
      }
      setPanelOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof AdminApiError ? err.message : "ذخیره دسته‌بندی با خطا مواجه شد");
    } finally {
      setSaving(false);
    }
  }

  const panel =
    mounted && panelOpen
      ? createPortal(
          <>
            <div className={styles.panelScrim} onClick={closePanel} aria-hidden="true" />
            <div className={styles.panel} role="dialog" aria-modal="true" aria-label={editingId ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>{editingId ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}</span>
                <button type="button" className={styles.iconButton} aria-label="بستن" onClick={closePanel}>
                  <CloseIcon />
                </button>
              </div>

              <form id="category-form" onSubmit={handleSubmit}>
                <div className={styles.panelBody}>
                  {formError && (
                    <p className={`${styles.errorState} ${styles.errorState}`} role="alert">
                      {formError}
                    </p>
                  )}

                  <label className={styles.field}>
                    نام دسته‌بندی
                    <input
                      className={styles.input}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      maxLength={120}
                    />
                  </label>

                  <label className={styles.field}>
                    شناسه (slug)
                    <input
                      className={styles.input}
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      placeholder="masalan-mahsoolat-daryaei"
                      required
                      maxLength={160}
                      dir="ltr"
                    />
                  </label>

                  <label className={styles.field}>
                    کلید آیکون (اختیاری)
                    <input
                      className={styles.input}
                      value={form.iconKey}
                      onChange={(e) => setForm({ ...form, iconKey: e.target.value })}
                      maxLength={80}
                      dir="ltr"
                    />
                  </label>

                  <label className={styles.field}>
                    آدرس تصویر (اختیاری)
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

                  <label className={styles.field}>
                    ترتیب نمایش
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className={styles.input}
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    />
                  </label>

                  <label className={styles.field}>
                    وضعیت
                    <select
                      className={styles.input}
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as AdminCategoryStatus })}
                    >
                      <option value="ACTIVE">فعال</option>
                      <option value="HIDDEN">پنهان</option>
                    </select>
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
        <h1 className={styles.title}>دسته‌بندی‌ها</h1>
        <button type="button" className={styles.newButton} onClick={openCreate}>
          <PlusIcon width={18} height={18} />
          دسته‌بندی جدید
        </button>
      </div>

      {state === "loading" && (
        <div className={styles.skeletonList} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
          <span className="visually-hidden" role="status">
            در حال بارگذاری دسته‌بندی‌ها...
          </span>
        </div>
      )}

      {state === "error" && (
        <p className={styles.errorState} role="alert">
          {errorMessage}
        </p>
      )}

      {state === "loaded" && categories.length === 0 && (
        <p className={styles.emptyState}>هنوز دسته‌بندی‌ای ایجاد نشده است. برای شروع، یک دسته‌بندی جدید بسازید.</p>
      )}

      {state === "loaded" && categories.length > 0 && (
        <>
          <p className={styles.totalLabel}>{toPersianDigits(categories.length)} دسته‌بندی</p>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>نام</th>
                <th>شناسه</th>
                <th>ترتیب</th>
                <th>تعداد محصول</th>
                <th>وضعیت</th>
                <th className="visually-hidden">ویرایش</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td data-label="نام">
                    <button type="button" className={styles.nameLink} onClick={() => openEdit(category)}>
                      {category.name}
                    </button>
                  </td>
                  <td data-label="شناسه" dir="ltr">
                    {category.slug}
                  </td>
                  <td data-label="ترتیب">{toPersianDigits(category.sortOrder)}</td>
                  <td data-label="تعداد محصول">{toPersianDigits(category.productCount)}</td>
                  <td data-label="وضعیت">
                    <span
                      className={`${styles.statusBadge} ${category.status === "ACTIVE" ? styles.badgeActive : styles.badgeHidden}`}
                    >
                      {STATUS_LABEL[category.status]}
                    </span>
                  </td>
                  <td data-label="">
                    <button type="button" className={styles.editLink} onClick={() => openEdit(category)}>
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
