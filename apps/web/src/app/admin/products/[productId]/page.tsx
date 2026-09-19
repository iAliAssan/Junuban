import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProductForm } from "../product-form";

export const metadata: Metadata = {
  title: "ویرایش محصول",
};

export default function EditAdminProductPage({ params }: { params: { productId: string } }) {
  return (
    <AdminShell>
      <ProductForm productId={params.productId} />
    </AdminShell>
  );
}
