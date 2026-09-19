import type { Metadata } from "next";
import { OrderDetailClient } from "./order-detail-client";

export const metadata: Metadata = {
  title: "جزئیات سفارش",
  robots: { index: false },
};

export default function OrderDetailPage({ params }: { params: { orderId: string } }) {
  return <OrderDetailClient orderId={params.orderId} />;
}
