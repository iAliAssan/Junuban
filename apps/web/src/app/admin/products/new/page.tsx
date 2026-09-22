import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProductForm } from "../product-form";

export const metadata: Metadata = {
  title: "محصول جدید",
};

export default function NewAdminProductPage() {
  return (
    <AdminShell>
      <ProductForm />
    </AdminShell>
  );
}
