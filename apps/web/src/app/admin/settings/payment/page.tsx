import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPaymentSettingsPageClient } from "./admin-payment-settings-page-client";

export const metadata: Metadata = {
  title: "تنظیمات پرداخت",
};

export default function AdminPaymentSettingsPage() {
  return (
    <AdminShell>
      <AdminPaymentSettingsPageClient />
    </AdminShell>
  );
}
