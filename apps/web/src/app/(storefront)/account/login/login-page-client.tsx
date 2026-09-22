"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi, AuthApiError } from "@/lib/otp-auth-client";
import { toPersianDigits } from "@/lib/format";
import styles from "./login-page.module.css";

const IRAN_MOBILE = /^(\+?98|0)?9\d{9}$/;
const RESEND_COOLDOWN_SECONDS = 60;

export function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/account";

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!IRAN_MOBILE.test(phone.trim())) {
      setError("شماره موبایل معتبر نیست");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.requestOtp(phone.trim());
      setStep("code");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "ارسال کد با خطا مواجه شد");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      await authApi.requestOtp(phone.trim());
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setCode("");
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "ارسال مجدد کد با خطا مواجه شد");
    } finally {
      setResending(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!/^\d{6}$/.test(code.trim())) {
      setError("کد تایید باید ۶ رقم باشد");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.verifyOtp(phone.trim(), code.trim());
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "کد وارد شده صحیح نیست");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div className={`container ${styles.centerRow}`}>
        <div className={styles.card}>
          <h1 className={styles.title}>ورود به جنوبان</h1>
          <p className={styles.subtitle}>
            {step === "phone" ? "شماره موبایل خود را وارد کنید" : `کد ارسال‌شده به ${phone} را وارد کنید`}
          </p>

          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}

          {step === "phone" ? (
            <form onSubmit={handleRequestOtp} noValidate>
              <div className={styles.field}>
                <label htmlFor="login-phone">شماره موبایل</label>
                <input
                  id="login-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09121234567"
                  dir="ltr"
                />
              </div>
              <button type="submit" className={styles.submitButton} disabled={submitting}>
                {submitting ? "در حال ارسال..." : "ارسال کد تایید"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} noValidate>
              <div className={styles.field}>
                <label htmlFor="login-code">کد تایید</label>
                <input
                  id="login-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="۱۲۳۴۵۶"
                  dir="ltr"
                />
              </div>
              <button type="submit" className={styles.submitButton} disabled={submitting}>
                {submitting ? "در حال بررسی..." : "تایید و ورود"}
              </button>
              <button
                type="button"
                className={styles.resendButton}
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || resending}
              >
                {resending
                  ? "در حال ارسال..."
                  : resendCooldown > 0
                    ? `ارسال مجدد کد (${toPersianDigits(resendCooldown)})`
                    : "ارسال مجدد کد"}
              </button>
              <button
                type="button"
                className={styles.changePhone}
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                  setResendCooldown(0);
                }}
              >
                تغییر شماره موبایل
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
