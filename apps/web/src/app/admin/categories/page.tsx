import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCategoriesPageClient } from "./admin-categories-page-client";

export const metadata: Metadata = {
  title: "دسته‌بندی‌ها",
};

export default function AdminCategoriesPage() {
  return (
    <AdminShell>
      <AdminCategoriesPageClient />
    </AdminShell>
  );
}
