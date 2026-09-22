import type { ShippingAddressInput } from "./checkout-client";

export type CheckoutFieldErrors = Partial<Record<keyof ShippingAddressInput | "guestPhone", string>>;

const IRAN_MOBILE = /^(\+?98|0)?9\d{9}$/;
const POSTAL_CODE = /^\d{10}$/;

/**
 * Client-side validation for immediate, accessible inline feedback only.
 * The server (CheckoutDto) is the authoritative validator — this never
 * replaces it, it just avoids a round-trip for obviously-invalid input.
 */
export function validateShippingAddress(input: Partial<ShippingAddressInput>): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};

  if (!input.recipientName?.trim()) {
    errors.recipientName = "نام گیرنده الزامی است";
  }
  if (!input.phone?.trim()) {
    errors.phone = "شماره موبایل الزامی است";
  } else if (!IRAN_MOBILE.test(input.phone.trim())) {
    errors.phone = "شماره موبایل معتبر نیست";
  }
  if (!input.province?.trim()) {
    errors.province = "استان الزامی است";
  }
  if (!input.city?.trim()) {
    errors.city = "شهر الزامی است";
  }
  if (!input.addressLine?.trim()) {
    errors.addressLine = "آدرس الزامی است";
  }
  if (!input.postalCode?.trim()) {
    errors.postalCode = "کد پستی الزامی است";
  } else if (!POSTAL_CODE.test(input.postalCode.trim())) {
    errors.postalCode = "کد پستی باید ۱۰ رقم باشد";
  }

  return errors;
}

export function validateGuestPhone(phone: string | undefined, isAuthenticated: boolean): CheckoutFieldErrors {
  if (isAuthenticated) return {};
  if (!phone?.trim()) return { guestPhone: "برای ثبت سفارش مهمان، شماره موبایل الزامی است" };
  if (!IRAN_MOBILE.test(phone.trim())) return { guestPhone: "شماره موبایل معتبر نیست" };
  return {};
}

export function hasErrors(errors: CheckoutFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
