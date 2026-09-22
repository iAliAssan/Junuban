import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminOrderDetailClient } from "./admin-order-detail-client";

export const metadata: Metadata = {
  title: "جزئیات سفارش",
};

export default function AdminOrderDetailPage({ params }: { params: { orderId: string } }) {
  return (
    <AdminShell>
      <AdminOrderDetailClient orderId={params.orderId} />
    </AdminShell>
  );
}
