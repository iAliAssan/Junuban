import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "سفارش‌های من",
  robots: { index: false },
};

export default function OrdersPage() {
  return (
    <main>
      <h1>سفارش‌های من</h1>
      <p>هنوز سفارشی ثبت نکرده‌اید.</p>
      <Link href="/products">مشاهده محصولات</Link>
    </main>
  );
}