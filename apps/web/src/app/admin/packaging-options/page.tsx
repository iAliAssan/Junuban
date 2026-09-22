import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPackagingOptionsPageClient } from "./admin-packaging-options-page-client";

export const metadata: Metadata = {
  title: "گزینه‌های بسته‌بندی",
};

export default function AdminPackagingOptionsPage() {
  return (
    <AdminShell>
      <AdminPackagingOptionsPageClient />
    </AdminShell>
  );
}
