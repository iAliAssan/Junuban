"use client";

import type { CheckoutFieldErrors } from "@/lib/checkout-validation";
import styles from "./address-form.module.css";

export interface AddressFormValues {
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
}

interface AddressFormFieldsProps {
  value: AddressFormValues;
  onChange: (next: AddressFormValues) => void;
  errors: CheckoutFieldErrors;
  /** Prefixes every input id/label-for so two instances can coexist on one page without id collisions. */
  idPrefix?: string;
}

/**
 * The recipientName/phone/province/city/addressLine/postalCode field set,
 * shared between the checkout page's inline "new address" form and the
 * account/addresses book (both ultimately validate against
 * AddressFieldsDto on the backend — see that file's own comment on why
 * it's factored out the same way there). Extracted here rather than
 * duplicated so a future field addition/validation change only has to
 * happen once.
 */
export function AddressFormFields({ value, onChange, errors, idPrefix = "" }: AddressFormFieldsProps) {
  const id = (field: string) => `${idPrefix}${field}`;

  return (
    <div className={styles.fieldGrid}>
      <div className={`${styles.field} ${styles.fieldFull}`}>
        <label htmlFor={id("recipientName")}>نام گیرنده</label>
        <input
          id={id("recipientName")}
          autoComplete="name"
          value={value.recipientName}
          onChange={(e) => onChange({ ...value, recipientName: e.target.value })}
          aria-invalid={Boolean(errors.recipientName)}
          aria-describedby={errors.recipientName ? id("recipientName-error") : undefined}
        />
        {errors.recipientName && (
          <span id={id("recipientName-error")} className={styles.fieldError} role="alert">
            {errors.recipientName}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor={id("phone")}>شماره تماس</label>
        <input
          id={id("phone")}
          type="tel"
          autoComplete="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? id("phone-error") : undefined}
        />
        {errors.phone && (
          <span id={id("phone-error")} className={styles.fieldError} role="alert">
            {errors.phone}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor={id("postalCode")}>کد پستی</label>
        <input
          id={id("postalCode")}
          inputMode="numeric"
          autoComplete="postal-code"
          value={value.postalCode}
          onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
          aria-invalid={Boolean(errors.postalCode)}
          aria-describedby={errors.postalCode ? id("postalCode-error") : undefined}
        />
        {errors.postalCode && (
          <span id={id("postalCode-error")} className={styles.fieldError} role="alert">
            {errors.postalCode}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor={id("province")}>استان</label>
        <input
          id={id("province")}
          autoComplete="address-level1"
          value={value.province}
          onChange={(e) => onChange({ ...value, province: e.target.value })}
          aria-invalid={Boolean(errors.province)}
          aria-describedby={errors.province ? id("province-error") : undefined}
        />
        {errors.province && (
          <span id={id("province-error")} className={styles.fieldError} role="alert">
            {errors.province}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor={id("city")}>شهر</label>
        <input
          id={id("city")}
          autoComplete="address-level2"
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          aria-invalid={Boolean(errors.city)}
          aria-describedby={errors.city ? id("city-error") : undefined}
        />
        {errors.city && (
          <span id={id("city-error")} className={styles.fieldError} role="alert">
            {errors.city}
          </span>
        )}
      </div>

      <div className={`${styles.field} ${styles.fieldFull}`}>
        <label htmlFor={id("addressLine")}>آدرس کامل</label>
        <input
          id={id("addressLine")}
          autoComplete="street-address"
          value={value.addressLine}
          onChange={(e) => onChange({ ...value, addressLine: e.target.value })}
          aria-invalid={Boolean(errors.addressLine)}
          aria-describedby={errors.addressLine ? id("addressLine-error") : undefined}
        />
        {errors.addressLine && (
          <span id={id("addressLine-error")} className={styles.fieldError} role="alert">
            {errors.addressLine}
          </span>
        )}
      </div>
    </div>
  );
}
