import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminProducersPageClient } from "./admin-producers-page-client";

export const metadata: Metadata = {
  title: "تولیدکنندگان",
};

export default function AdminProducersPage() {
  return (
    <AdminShell>
      <AdminProducersPageClient />
    </AdminShell>
  );
}
