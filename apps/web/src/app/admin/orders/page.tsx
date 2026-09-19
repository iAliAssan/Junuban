import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminOrdersPageClient } from "./admin-orders-page-client";

export const metadata: Metadata = {
  title: "سفارش‌ها",
};

export default function AdminOrdersPage() {
  return (
    <AdminShell>
      <AdminOrdersPageClient />
    </AdminShell>
  );
}
