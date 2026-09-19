import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminActivityLogPageClient } from "./admin-activity-log-page-client";

export const metadata: Metadata = {
  title: "فعالیت‌های اخیر",
};

export default function AdminActivityLogPage() {
  return (
    <AdminShell>
      <AdminActivityLogPageClient />
    </AdminShell>
  );
}
