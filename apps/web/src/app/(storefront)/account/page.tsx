import type { Metadata } from "next";
import { AccountPageClient } from "./account-page-client";

export const metadata: Metadata = {
  title: "حساب کاربری",
  robots: { index: false },
};

export default function AccountPage() {
  return <AccountPageClient />;
}
