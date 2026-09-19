"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  adminProductsApi,
  AdminApiError,
  type AdminProductDetail,
  type AdminProductFormOptions,
  type AdminWeightOptionInput,
  type AdminProductProducerInput,
  type AdminProductMediaInput,
  type CreateProductPayload,
} from "@/lib/admin-products-client";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Toast } from "@/components/admin/toast";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatToman, toPersianDigits } from "@/lib/format";
import styles from "./product-form.module.css";

// A weight option needs a client-side-stable key to be referenced by
// the variant rows below *before* it has a real database id (new
// product, or a newly-added weight option on an existing one) — `key`
// never leaves the browser; only `id` (when present) is sent to the API.
interface WeightOptionRow extends AdminWeightOptionInput {
  key: string;
}

interface VariantRow {
  key: string;
  id?: string;
  weightOptionKey: string;
  price: string;
  sku: string;
  isActive: boolean;
}

interface ProducerRow {
  key: string;
  id?: string;
  producerId: string;
  isDefault: boolean;
  onHandGrams: string;
  lowStockThresholdGrams: string;
  variants: VariantRow[];
}

interface MediaRow extends AdminProductMediaInput {
  key: string;
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `k${keyCounter}`;
}

function emptyWeightOption(): WeightOptionRow {
  return { key: nextKey(), label: "", grams: 0 };
}

function emptyVariant(weightOptionKey: string): VariantRow {
  return { key: nextKey(), weightOptionKey, price: "", sku: "", isActive: true };
}

function emptyProducer(): ProducerRow {
  return {
    key: nextKey(),
    producerId: "",
    isDefault: false,
    onHandGrams: "0",
    lowStockThresholdGrams: "",
    variants: [],
  };
}

function emptyMedia(): MediaRow {
  return { key: nextKey(), url: "", altText: "" };
}

export function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(productId);

  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">(isEdit ? "loading" : "loaded");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOptions, setFormOptions] = useState<AdminProductFormOptions | null>(null);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [harvestSeason, setHarvestSeason] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [status, setStatus] = useState<AdminProductDetail["status"]>("DRAFT");

  const [weightOptions, setWeightOptions] = useState<WeightOptionRow[]>([emptyWeightOption()]);
  const [producers, setProducers] = useState<ProducerRow[]>([emptyProducer()]);
  const [media, setMedia] = useState<MediaRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusPending, setStatusPending] = useState(false);

  useEffect(() => {
    adminProductsApi.formOptions().then(setFormOptions).catch(() => setFormOptions({ categories: [], producers: [] }));
  }, []);

  useEffect(() => {
    if (!productId) return;
    adminProductsApi
      .get(productId)
      .then((product) => {
        setSlug(product.slug);
        setName(product.name);
        setDescription(product.description ?? "");
        setCategoryId(product.category.id);
        setHarvestSeason(product.harvestSeason ?? "");
        setMetaTitle(product.metaTitle ?? "");
        setMetaDescription(product.metaDescription ?? "");
        setStatus(product.status);

        const weightRows: WeightOptionRow[] = product.weightOptions.map((w) => ({
          key: nextKey(),
          id: w.id,
          label: w.label,
          grams: w.grams,
          sortOrder: w.sortOrder,
        }));
        setWeightOptions(weightRows.length > 0 ? weightRows : [emptyWeightOption()]);

        // Map each variant's server weightOptionId to this form's local
        // weightOptionKey so edits to a weight option's grams don't
        // require re-linking every variant that references it.
        const keyByServerId = new Map(weightRows.map((w) => [w.id, w.key]));

        setProducers(
          product.producers.map((pp) => ({
            key: nextKey(),
            id: pp.id,
            producerId: pp.producerId,
            isDefault: pp.isDefault,
            onHandGrams: String(pp.onHandGrams),
            lowStockThresholdGrams: pp.lowStockThresholdGrams !== null ? String(pp.lowStockThresholdGrams) : "",
            variants: pp.variants.map((v) => ({
              key: nextKey(),
              id: v.id,
              weightOptionKey: keyByServerId.get(v.weightOptionId) ?? "",
              price: String(v.price),
              sku: v.sku,
              isActive: v.isActive,
            })),
          })),
        );

        setMedia(product.images.map((img) => ({ key: nextKey(), id: img.id, url: img.url, altText: img.altText, sortOrder: img.sortOrder })));
        setLoadState("loaded");
      })
      .catch((err) => {
        setLoadError(err instanceof AdminApiError ? err.message : "بارگذاری محصول با خطا مواجه شد");
        setLoadState("error");
      });
  }, [productId]);

  function addWeightOption() {
    setWeightOptions((rows) => [...rows, emptyWeightOption()]);
  }

  function removeWeightOption(key: string) {
    setWeightOptions((rows) => rows.filter((r) => r.key !== key));
    // Also drop any variant referencing the removed weight option — an
    // orphaned reference would fail server-side validation anyway, and
    // removing it here gives the admin immediate, honest feedback about
    // what their action actually did.
    setProducers((rows) =>
      rows.map((p) => ({ ...p, variants: p.variants.filter((v) => v.weightOptionKey !== key) })),
    );
  }

  function addProducer() {
    setProducers((rows) => [...rows, emptyProducer()]);
  }

  function removeProducer(key: string) {
    setProducers((rows) => rows.filter((r) => r.key !== key));
  }

  function updateProducer(key: string, patch: Partial<ProducerRow>) {
    setProducers((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function setDefaultProducer(key: string) {
    setProducers((rows) => rows.map((r) => ({ ...r, isDefault: r.key === key })));
  }

  function addVariant(producerKey: string) {
    if (weightOptions.length === 0) return;
    setProducers((rows) =>
      rows.map((r) => (r.key === producerKey ? { ...r, variants: [...r.variants, emptyVariant(weightOptions[0]!.key)] } : r)),
    );
  }

  function removeVariant(producerKey: string, variantKey: string) {
    setProducers((rows) =>
      rows.map((r) =>
        r.key === producerKey ? { ...r, variants: r.variants.filter((v) => v.key !== variantKey) } : r,
      ),
    );
  }

  function updateVariant(producerKey: string, variantKey: string, patch: Partial<VariantRow>) {
    setProducers((rows) =>
      rows.map((r) =>
        r.key === producerKey
          ? { ...r, variants: r.variants.map((v) => (v.key === variantKey ? { ...v, ...patch } : v)) }
          : r,
      ),
    );
  }

  function addMedia() {
    setMedia((rows) => [...rows, emptyMedia()]);
  }

  function removeMedia(key: string) {
    setMedia((rows) => rows.filter((r) => r.key !== key));
  }

  function updateMedia(key: string, patch: Partial<MediaRow>) {
    setMedia((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function buildPayload(): CreateProductPayload | null {
    if (!slug.trim() || !name.trim() || !categoryId) {
      setSaveError("شناسه، نام و دسته‌بندی محصول الزامی است");
      return null;
    }
    // Mirrors WeightOptionInputDto on the backend (@IsInt, @Min(1), @Max(1_000_000)).
    const MAX_GRAMS = 1_000_000;
    if (weightOptions.some((w) => !w.label.trim() || !Number.isInteger(w.grams) || w.grams < 1)) {
      setSaveError("همه گزینه‌های وزنی باید برچسب و وزن صحیح (گرم، بدون اعشار) داشته باشند");
      return null;
    }
    if (weightOptions.some((w) => w.grams > MAX_GRAMS)) {
      setSaveError(`وزن هر گزینه نباید بیشتر از ${toPersianDigits(MAX_GRAMS)} گرم باشد`);
      return null;
    }
    if (producers.length === 0 || producers.some((p) => !p.producerId)) {
      setSaveError("حداقل یک تولیدکننده باید انتخاب شود");
      return null;
    }
    if (producers.some((p) => p.variants.length === 0)) {
      setSaveError("هر تولیدکننده باید حداقل یک تنوع (وزن + قیمت) داشته باشد");
      return null;
    }
    // Mirrors ProducerLinkInputDto's onHandGrams/lowStockThresholdGrams
    // (@IsInt, @Min(0)) — unlike price/grams above there's no upper
    // bound server-side (bulk stock can legitimately be large), just
    // integer + non-negative. Both fields are optional (omitted =
    // "leave unchanged" for onHandGrams on update / "no threshold" for
    // lowStockThresholdGrams), so an empty string is valid.
    const isValidOptionalNonNegativeInt = (raw: string) => {
      if (raw.trim() === "") return true;
      const n = Number(raw);
      return !Number.isNaN(n) && Number.isInteger(n) && n >= 0;
    };
    if (producers.some((p) => !isValidOptionalNonNegativeInt(p.onHandGrams))) {
      setSaveError("موجودی انبار باید یک عدد صحیح نامنفی (گرم) باشد");
      return null;
    }
    if (producers.some((p) => !isValidOptionalNonNegativeInt(p.lowStockThresholdGrams))) {
      setSaveError("آستانه هشدار موجودی کم باید یک عدد صحیح نامنفی (گرم) باشد");
      return null;
    }
    // Mirrors VariantInputDto on the backend exactly (@IsInt, @Min(0),
    // @Max(1_000_000_000)) so a mistake is caught here with a specific,
    // actionable message rather than surfacing as a generic 400 from
    // the API after a round trip.
    const MAX_VARIANT_PRICE = 1_000_000_000;
    for (const p of producers) {
      for (const v of p.variants) {
        const priceNum = Number(v.price);
        if (!v.weightOptionKey || v.price.trim() === "" || Number.isNaN(priceNum)) {
          setSaveError("قیمت هر تنوع باید یک عدد معتبر باشد");
          return null;
        }
        if (!Number.isInteger(priceNum)) {
          setSaveError("قیمت باید یک عدد صحیح (بدون اعشار) باشد");
          return null;
        }
        if (priceNum < 0 || priceNum > MAX_VARIANT_PRICE) {
          setSaveError(`قیمت باید بین ۰ تا ${toPersianDigits(MAX_VARIANT_PRICE)} تومان باشد`);
          return null;
        }
      }
    }
    if (media.some((m) => !m.url.trim() || !m.altText.trim())) {
      setSaveError("هر تصویر باید آدرس و متن جایگزین داشته باشد");
      return null;
    }
    // Mirrors ProductMediaInputDto's @IsUrl on the backend — a quick
    // shape check (not exhaustive RFC validation) so a plainly-invalid
    // value like "not a url" is caught here instead of round-tripping
    // to the API first. Restricted to http(s) specifically, since a
    // product image URL should never legitimately be another scheme.
    if (
      media.some((m) => {
        try {
          return !["http:", "https:"].includes(new URL(m.url.trim()).protocol);
        } catch {
          return true;
        }
      })
    ) {
      setSaveError("آدرس تصویر معتبر نیست (باید با http:// یا https:// شروع شود)");
      return null;
    }

    return {
      slug: slug.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId,
      harvestSeason: harvestSeason.trim() || undefined,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      weightOptions: weightOptions.map((w) => ({
        id: w.id,
        label: w.label.trim(),
        grams: w.grams,
        sortOrder: w.sortOrder,
      })),
      producers: producers.map<AdminProductProducerInput>((p) => ({
        id: p.id,
        producerId: p.producerId,
        isDefault: p.isDefault,
        onHandGrams: p.onHandGrams.trim() === "" ? undefined : Number(p.onHandGrams),
        lowStockThresholdGrams: p.lowStockThresholdGrams.trim() === "" ? undefined : Number(p.lowStockThresholdGrams),
        variants: p.variants.map((v) => {
          // weightOptionKey resolves to either a real server id (existing
          // weight option) or, for a brand-new one, its grams value —
          // AdminProductsService.syncNestedRelations resolves a newly
          // created weight option by its grams as well as by any client
          // id, so sending the grams value here is a valid reference
          // even though this weight option doesn't have a server id yet.
          const weightOption = weightOptions.find((w) => w.key === v.weightOptionKey);
          return {
            id: v.id,
            weightOptionId: weightOption?.id ?? String(weightOption?.grams ?? ""),
            price: Number(v.price),
            sku: v.sku.trim() || undefined,
            isActive: v.isActive,
          };
        }),
      })),
      media: media.map((m) => ({ id: m.id, url: m.url.trim(), altText: m.altText.trim(), sortOrder: m.sortOrder })),
    };
  }

  async function handleSave() {
    setSaveError(null);
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    try {
      if (isEdit && productId) {
        await adminProductsApi.update(productId, payload);
        setToastMessage("تغییرات ذخیره شد");
      } else {
        const created = await adminProductsApi.create(payload);
        setToastMessage("محصول ایجاد شد");
        router.push(`/admin/products/${created.id}`);
        return;
      }
    } catch (err) {
      setSaveError(err instanceof AdminApiError ? err.message : "ذخیره محصول با خطا مواجه شد");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!productId) return;
    setStatusPending(true);
    try {
      const nextStatus = status === "ACTIVE" ? "DRAFT" : "ACTIVE";
      const updated = await adminProductsApi.setStatus(productId, nextStatus);
      setStatus(updated.status);
      setToastMessage(nextStatus === "ACTIVE" ? "محصول منتشر شد" : "محصول از انتشار خارج شد");
    } catch (err) {
      setToastMessage(err instanceof AdminApiError ? err.message : "تغییر وضعیت با خطا مواجه شد");
    } finally {
      setStatusPending(false);
      setStatusDialogOpen(false);
    }
  }

  if (loadState === "loading") {
    return <p role="status">در حال بارگذاری محصول...</p>;
  }
  if (loadState === "error") {
    return (
      <p className={styles.errorState} role="alert">
        {loadError}
      </p>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>{isEdit ? "ویرایش محصول" : "محصول جدید"}</h1>
        {isEdit && (
          <button
            type="button"
            className={status === "ACTIVE" ? styles.unpublishButton : styles.publishButton}
            onClick={() => setStatusDialogOpen(true)}
            disabled={status === "ARCHIVED"}
          >
            {status === "ACTIVE" ? "خارج کردن از انتشار" : "انتشار محصول"}
          </button>
        )}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>اطلاعات کلی</h2>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span>نام محصول</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={styles.input} />
          </label>
          <label className={styles.field}>
            <span>شناسه (slug)</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={styles.input}
              dir="ltr"
              placeholder="e.g. sidr-honey-500g"
            />
          </label>
        </div>
        <label className={styles.field}>
          <span>توضیحات</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={styles.textarea} rows={4} />
        </label>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span>دسته‌بندی</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={styles.input}>
              <option value="">انتخاب کنید</option>
              {formOptions?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.status !== "ACTIVE" ? "(غیرفعال)" : ""}
                </option>
              ))}
            </select>
            {formOptions && formOptions.categories.length === 0 && (
              <p className={styles.hint}>
                هنوز هیچ دسته‌بندی‌ای ثبت نشده است.{" "}
                <Link href="/admin/categories" target="_blank" rel="noopener noreferrer">
                  یک دسته‌بندی جدید بسازید
                </Link>{" "}
                و سپس این صفحه را دوباره بارگذاری کنید.
              </p>
            )}
          </label>
          <label className={styles.field}>
            <span>فصل برداشت (اختیاری)</span>
            <input value={harvestSeason} onChange={(e) => setHarvestSeason(e.target.value)} className={styles.input} />
          </label>
        </div>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span>عنوان سئو (اختیاری)</span>
            <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className={styles.input} />
          </label>
          <label className={styles.field}>
            <span>توضیحات سئو (اختیاری)</span>
            <input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} className={styles.input} />
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>گزینه‌های وزنی</h2>
          <button type="button" className={styles.addButton} onClick={addWeightOption}>
            <PlusIcon width={16} height={16} />
            افزودن گزینه وزنی
          </button>
        </div>
        {weightOptions.map((w) => (
          <div key={w.key} className={styles.weightRow}>
            <label className={styles.field}>
              <span>برچسب</span>
              <input
                value={w.label}
                onChange={(e) => setWeightOptions((rows) => rows.map((r) => (r.key === w.key ? { ...r, label: e.target.value } : r)))}
                className={styles.input}
                placeholder="۵۰۰ گرم"
              />
            </label>
            <label className={styles.field}>
              <span>وزن (گرم)</span>
              <input
                type="number"
                min={1}
                max={1_000_000}
                step={1}
                value={w.grams || ""}
                onChange={(e) =>
                  setWeightOptions((rows) => rows.map((r) => (r.key === w.key ? { ...r, grams: Number(e.target.value) } : r)))
                }
                className={styles.input}
              />
            </label>
            <button
              type="button"
              className={styles.iconRemoveButton}
              onClick={() => removeWeightOption(w.key)}
              aria-label="حذف گزینه وزنی"
              disabled={weightOptions.length === 1}
            >
              <TrashIcon width={18} height={18} />
            </button>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>تولیدکنندگان و تنوع‌ها</h2>
          <button
            type="button"
            className={styles.addButton}
            onClick={addProducer}
            disabled={formOptions !== null && formOptions.producers.length === 0}
          >
            <PlusIcon width={16} height={16} />
            افزودن تولیدکننده
          </button>
        </div>

        {formOptions && formOptions.producers.length === 0 && (
          <p className={styles.emptyHint}>
            هنوز هیچ تولیدکننده‌ای ثبت نشده است.{" "}
            <Link href="/admin/producers" target="_blank" rel="noopener noreferrer">
              یک تولیدکننده جدید بسازید
            </Link>{" "}
            و سپس این صفحه را دوباره بارگذاری کنید — بدون حداقل یک تولیدکننده، این محصول قابل فروش نخواهد بود.
          </p>
        )}

        {producers.map((p) => (
          <div key={p.key} className={styles.producerCard}>
            <div className={styles.producerCardHeader}>
              <label className={styles.field}>
                <span>تولیدکننده</span>
                <select
                  value={p.producerId}
                  onChange={(e) => updateProducer(p.key, { producerId: e.target.value })}
                  className={styles.input}
                >
                  <option value="">انتخاب کنید</option>
                  {formOptions?.producers.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} — {prod.region} {prod.status !== "ACTIVE" ? "(غیرفعال)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.checkboxField}>
                <input type="radio" name="default-producer" checked={p.isDefault} onChange={() => setDefaultProducer(p.key)} />
                <span>تولیدکننده پیش‌فرض</span>
              </label>

              <button
                type="button"
                className={styles.iconRemoveButton}
                onClick={() => removeProducer(p.key)}
                aria-label="حذف تولیدکننده"
                disabled={producers.length === 1}
              >
                <TrashIcon width={18} height={18} />
              </button>
            </div>

            <div className={styles.grid2}>
              <label className={styles.field}>
                <span>موجودی انبار (گرم)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={p.onHandGrams}
                  onChange={(e) => updateProducer(p.key, { onHandGrams: e.target.value })}
                  className={styles.input}
                />
              </label>
              <label className={styles.field}>
                <span>آستانه هشدار موجودی کم (اختیاری، گرم)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={p.lowStockThresholdGrams}
                  onChange={(e) => updateProducer(p.key, { lowStockThresholdGrams: e.target.value })}
                  className={styles.input}
                />
              </label>
            </div>

            <div className={styles.variantsHeader}>
              <span>تنوع‌ها (وزن + قیمت)</span>
              <button type="button" className={styles.addButtonSmall} onClick={() => addVariant(p.key)}>
                <PlusIcon width={14} height={14} />
                افزودن تنوع
              </button>
            </div>

            {p.variants.length === 0 && <p className={styles.emptyHint}>هنوز تنوعی اضافه نشده است.</p>}

            {p.variants.map((v) => (
              <div key={v.key} className={styles.variantRow}>
                <label className={styles.field}>
                  <span>وزن</span>
                  <select
                    value={v.weightOptionKey}
                    onChange={(e) => updateVariant(p.key, v.key, { weightOptionKey: e.target.value })}
                    className={styles.input}
                  >
                    {weightOptions.map((w) => (
                      <option key={w.key} value={w.key}>
                        {w.label || "بدون‌برچسب"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>قیمت (تومان)</span>
                  <input
                    type="number"
                    min={0}
                    max={1_000_000_000}
                    step={1}
                    value={v.price}
                    onChange={(e) => updateVariant(p.key, v.key, { price: e.target.value })}
                    className={styles.input}
                  />
                  {v.price && !Number.isNaN(Number(v.price)) && (
                    <span className={styles.priceHint}>{formatToman(Number(v.price))}</span>
                  )}
                </label>
                <label className={styles.field}>
                  <span>SKU (اختیاری)</span>
                  <input
                    value={v.sku}
                    onChange={(e) => updateVariant(p.key, v.key, { sku: e.target.value })}
                    className={styles.input}
                    dir="ltr"
                  />
                </label>
                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={v.isActive}
                    onChange={(e) => updateVariant(p.key, v.key, { isActive: e.target.checked })}
                  />
                  <span>فعال</span>
                </label>
                <button
                  type="button"
                  className={styles.iconRemoveButton}
                  onClick={() => removeVariant(p.key, v.key)}
                  aria-label="حذف تنوع"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>تصاویر محصول</h2>
          <button type="button" className={styles.addButton} onClick={addMedia}>
            <PlusIcon width={16} height={16} />
            افزودن تصویر
          </button>
        </div>
        <p className={styles.hint}>
          فعلاً افزودن تصویر با آدرس (URL) انجام می‌شود؛ بارگذاری مستقیم فایل در چرخه بعدی اضافه خواهد شد.
        </p>
        {media.map((m) => (
          <div key={m.key} className={styles.mediaRow}>
            <label className={styles.field}>
              <span>آدرس تصویر</span>
              <input value={m.url} onChange={(e) => updateMedia(m.key, { url: e.target.value })} className={styles.input} dir="ltr" />
            </label>
            <label className={styles.field}>
              <span>متن جایگزین (alt)</span>
              <input value={m.altText} onChange={(e) => updateMedia(m.key, { altText: e.target.value })} className={styles.input} />
            </label>
            {m.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt="" className={styles.mediaPreview} />
            )}
            <button type="button" className={styles.iconRemoveButton} onClick={() => removeMedia(m.key)} aria-label="حذف تصویر">
              <TrashIcon width={16} height={16} />
            </button>
          </div>
        ))}
      </section>

      {saveError && (
        <p className={styles.errorState} role="alert">
          {saveError}
        </p>
      )}

      <div className={styles.footerActions}>
        <button type="button" className={styles.saveButton} onClick={handleSave} disabled={saving}>
          {saving ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "ایجاد محصول"}
        </button>
      </div>

      <ConfirmDialog
        open={statusDialogOpen}
        title={status === "ACTIVE" ? "خارج کردن محصول از انتشار؟" : "انتشار محصول؟"}
        description={
          status === "ACTIVE"
            ? "این محصول دیگر در فروشگاه نمایش داده نخواهد شد."
            : "این محصول پس از انتشار برای مشتریان در فروشگاه قابل مشاهده و خرید خواهد بود."
        }
        confirmLabel={status === "ACTIVE" ? "خارج کردن از انتشار" : "انتشار"}
        pending={statusPending}
        onConfirm={handleToggleStatus}
        onCancel={() => setStatusDialogOpen(false)}
      />

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </div>
  );
}
