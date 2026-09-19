"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminAuthApi, getCurrentAdmin, AdminAuthApiError } from "@/lib/admin-auth-client";
import styles from "./admin-login-page.module.css";

/**
 * The admin login form. Consumes the real `POST /api/v1/admin/auth/login`
 * contract exactly as implemented in `apps/api/src/admin/auth/
 * admin-auth.controller.ts` (verified by reading that file directly
 * before writing this, per Cycle 8's master prompt §20): body is
 * `{ email, password }`, a 200 response sets the httpOnly session
 * cookie server-side and returns `{ admin }`, and failures come back
 * as real HTTP status codes (401 for bad credentials/disabled account,
 * 429 for rate limiting) with a real backend-authored message — never
 * collapsed into one generic string, per §21 ("do not blindly show
 * backend error messages to the user" is about not leaking internals,
 * not about hiding legitimate, already-Persian, already-safe messages
 * the backend deliberately wrote for this exact purpose).
 */
export function AdminLoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // If already logged in, skip the form entirely rather than making the
  // admin log in again — mirrors the customer login page's behavior.
  useEffect(() => {
    getCurrentAdmin().then((admin) => {
      if (admin) {
        router.replace(redirectTo);
      } else {
        setCheckingSession(false);
      }
    });
  }, [router, redirectTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!email.trim() || !password) {
      setError("ایمیل و رمز عبور را وارد کنید");
      return;
    }

    setSubmitting(true);
    try {
      await adminAuthApi.login(email.trim(), password);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof AdminAuthApiError ? err.message : "ورود با خطا مواجه شد");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <div className={styles.layout}>
        <p role="status">در حال بررسی نشست ورود...</p>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.card}>
        <h1 className={styles.title}>ورود به پنل مدیریت</h1>
        <p className={styles.subtitle}>جنوبان</p>

        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="admin-email">ایمیل</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@junuban.dev"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="admin-password">رمز عبور</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={submitting}>
            {submitting ? "در حال ورود..." : "ورود"}
          </button>
        </form>
      </div>
    </div>
  );
}
