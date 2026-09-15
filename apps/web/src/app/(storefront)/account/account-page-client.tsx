"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentCustomer, type AuthenticatedCustomer } from "@/lib/auth-client";
import { authApi } from "@/lib/otp-auth-client";
import { toPersianDigits } from "@/lib/format";
import styles from "./account-page.module.css";

export function AccountPageClient() {
  const router = useRouter();
  const [customer, setCustomer] = useState<AuthenticatedCustomer | null | "loading">("loading");

  useEffect(() => {
    getCurrentCustomer().then((c) => {
      setCustomer(c);
      if (!c) {
        router.replace("/account/login?redirect=/account");
      }
    });
  }, [router]);

  async function handleLogout() {
    await authApi.logout().catch(() => {});
    router.push("/");
    router.refresh();
  }

  if (customer === "loading" || !customer) {
    return (
      <div className={styles.layout}>
        <div className="container">
          <p role="status">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className="container">
        <h1 className={styles.title}>حساب کاربری</h1>
        <div className={styles.card}>
          <p className={styles.phone}>{toPersianDigits(customer.phone)}</p>
          <nav className={styles.linkList} aria-label="حساب کاربری">
            <Link href="/orders" className={styles.linkItem}>
              سفارش‌های من
            </Link>
          </nav>
          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            خروج از حساب
          </button>
        </div>
      </div>
    </div>
  );
}
