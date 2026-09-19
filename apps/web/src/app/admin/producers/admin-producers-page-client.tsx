"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  adminProducersApi,
  AdminApiError,
  type AdminProducer,
  type AdminProducerStatus,
  type CreateProducerPayload,
  type UpdateProducerPayload,
} from "@/lib/admin-producers-client";
import { Toast } from "@/components/admin/toast";
import { PlusIcon, CloseIcon } from "@/components/ui/icons";
import { toPersianDigits } from "@/lib/format";
import styles from "@/components/admin/reference-data-page.module.css";

const STATUS_LABEL: Record<AdminProducerStatus, string> = {
  ACTIVE: "فعال",
  HIDDEN: "پنهان",
};

type LoadState = "loading" | "loaded" | "error";

interface FormState {
  slug: string;
  name: string;
  bio: string;
  region: string;
  province: string;
  verified: boolean;
  status: AdminProducerStatus;
  photoUrl: string;
  photoAltText: string;
}

function emptyForm(): FormState {
  return {
    slug: "",
    name: "",
    bio: "",
    region: "",
    province: "",
    verified: false,
    status: "ACTIVE",
    photoUrl: "",
    photoAltText: "",
  };
}

function toFormState(producer: AdminProducer): FormState {
  return {
    slug: producer.slug,
    name: producer.name,
    bio: producer.bio ?? "",
    region: producer.region,
    province: producer.province,
    verified: producer.verified,
    status: producer.status,
    photoUrl: producer.photo?.url ?? "",
    photoAltText: producer.photo?.altText ?? "",
  };
}

export function AdminProducersPageClient() {
  const [producers, setProducers] = useState<AdminProducer[]>([]);
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
    adminProducersApi
      .list()
      .then((res) => {
        setProducers(res.items);
        setState("loaded");
      })
      .catch((err) => {
        setErrorMessage(err instanceof AdminApiError ? err.message : "دریافت تولیدکنندگان با خطا مواجه شد");
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

  function openEdit(producer: AdminProducer) {
    setEditingId(producer.id);
    setForm(toFormState(producer));
    setHadPhotoOnOpen(producer.photo !== null);
    setFormError(null);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.slug.trim() || !form.name.trim() || !form.region.trim() || !form.province.trim()) {
      setFormError("شناسه، نام، منطقه و استان الزامی هستند");
      return;
    }

    const photoUrl = form.photoUrl.trim();
    const photoAltText = form.photoAltText.trim();
    if (Boolean(photoUrl) !== Boolean(photoAltText)) {
      setFormError("برای تصویر تولیدکننده، هم آدرس و هم متن جایگزین لازم است (یا هر دو خالی بمانند)");
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

    // Three-state contract, mirroring ProducerPhotoInputDto on the
    // backend exactly (see that file's doc comment): both fields
    // filled → upsert; both empty AND there was a photo before →
    // explicit removal (`null`, update-only — see below); both empty
    // and there was never a photo → omit the key entirely so a
    // create/edit that never touched the photo doesn't accidentally
    // send an unnecessary (harmless, but noisy) `photo: null`.
    const photoObject = photoUrl && photoAltText ? { url: photoUrl, altText: photoAltText } : undefined;

    const basePayload = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      bio: form.bio.trim() || undefined,
      region: form.region.trim(),
      province: form.province.trim(),
      verified: form.verified,
      status: form.status,
    };

    setSaving(true);
    try {
      if (editingId) {
        // Unlike create, update can express "remove" — `hadPhotoOnOpen`
        // can only be true here (openCreate always sets it to false),
        // so `null` never reaches the create() call below.
        const updatePayload: UpdateProducerPayload = {
          ...basePayload,
          photo: photoObject ?? (hadPhotoOnOpen ? null : undefined),
        };
        await adminProducersApi.update(editingId, updatePayload);
        setToastMessage("تولیدکننده به‌روزرسانی شد");
      } else {
        const createPayload: CreateProducerPayload = { ...basePayload, photo: photoObject };
        await adminProducersApi.create(createPayload);
        setToastMessage("تولیدکننده ایجاد شد");
      }
      setPanelOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof AdminApiError ? err.message : "ذخیره تولیدکننده با خطا مواجه شد");
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
              aria-label={editingId ? "ویرایش تولیدکننده" : "تولیدکننده جدید"}
            >
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>{editingId ? "ویرایش تولیدکننده" : "تولیدکننده جدید"}</span>
                <button type="button" className={styles.iconButton} aria-label="بستن" onClick={closePanel}>
                  <CloseIcon />
                </button>
              </div>

              <form id="producer-form" onSubmit={handleSubmit}>
                <div className={styles.panelBody}>
                  {formError && (
                    <p className={styles.errorState} role="alert">
                      {formError}
                    </p>
                  )}

                  <label className={styles.field}>
                    نام تولیدکننده
                    <input
                      className={styles.input}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      maxLength={160}
                    />
                  </label>

                  <label className={styles.field}>
                    شناسه (slug)
                    <input
                      className={styles.input}
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      placeholder="masalan-tolidkonande-minab"
                      required
                      maxLength={160}
                      dir="ltr"
                    />
                  </label>

                  <label className={styles.field}>
                    منطقه (مثلاً «میناب، هرمزگان»)
                    <input
                      className={styles.input}
                      value={form.region}
                      onChange={(e) => setForm({ ...form, region: e.target.value })}
                      required
                      maxLength={160}
                    />
                  </label>

                  <label className={styles.field}>
                    استان
                    <input
                      className={styles.input}
                      value={form.province}
                      onChange={(e) => setForm({ ...form, province: e.target.value })}
                      required
                      maxLength={80}
                    />
                  </label>

                  <label className={styles.field}>
                    درباره (اختیاری)
                    <textarea
                      className={styles.textarea}
                      rows={4}
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      maxLength={4000}
                    />
                  </label>

                  <label className={styles.field}>
                    آدرس تصویر پروفایل (اختیاری)
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

                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={form.verified}
                      onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                    />
                    تولیدکننده تأییدشده
                  </label>

                  <label className={styles.field}>
                    وضعیت
                    <select
                      className={styles.input}
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as AdminProducerStatus })}
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
        <h1 className={styles.title}>تولیدکنندگان</h1>
        <button type="button" className={styles.newButton} onClick={openCreate}>
          <PlusIcon width={18} height={18} />
          تولیدکننده جدید
        </button>
      </div>

      {state === "loading" && (
        <div className={styles.skeletonList} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
          <span className="visually-hidden" role="status">
            در حال بارگذاری تولیدکنندگان...
          </span>
        </div>
      )}

      {state === "error" && (
        <p className={styles.errorState} role="alert">
          {errorMessage}
        </p>
      )}

      {state === "loaded" && producers.length === 0 && (
        <p className={styles.emptyState}>هنوز تولیدکننده‌ای ایجاد نشده است. برای شروع، یک تولیدکننده جدید بسازید.</p>
      )}

      {state === "loaded" && producers.length > 0 && (
        <>
          <p className={styles.totalLabel}>{toPersianDigits(producers.length)} تولیدکننده</p>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>نام</th>
                <th>منطقه</th>
                <th>استان</th>
                <th>تعداد محصول</th>
                <th>وضعیت</th>
                <th className="visually-hidden">ویرایش</th>
              </tr>
            </thead>
            <tbody>
              {producers.map((producer) => (
                <tr key={producer.id}>
                  <td data-label="نام">
                    <button type="button" className={styles.nameLink} onClick={() => openEdit(producer)}>
                      {producer.name}
                    </button>
                    {producer.verified && <span className={styles.verifiedBadge}> تأییدشده</span>}
                  </td>
                  <td data-label="منطقه">{producer.region}</td>
                  <td data-label="استان">{producer.province}</td>
                  <td data-label="تعداد محصول">{toPersianDigits(producer.productCount)}</td>
                  <td data-label="وضعیت">
                    <span
                      className={`${styles.statusBadge} ${producer.status === "ACTIVE" ? styles.badgeActive : styles.badgeHidden}`}
                    >
                      {STATUS_LABEL[producer.status]}
                    </span>
                  </td>
                  <td data-label="">
                    <button type="button" className={styles.editLink} onClick={() => openEdit(producer)}>
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
