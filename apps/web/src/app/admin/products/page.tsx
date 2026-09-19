import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminProductsPageClient } from "./admin-products-page-client";

export const metadata: Metadata = {
  title: "محصولات",
};

export default function AdminProductsPage() {
  return (
    <AdminShell>
      <AdminProductsPageClient />
    </AdminShell>
  );
}
