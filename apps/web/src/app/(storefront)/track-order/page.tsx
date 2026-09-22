import type { Metadata } from "next";
import { TrackOrderPageClient } from "./track-order-page-client";

export const metadata: Metadata = {
  title: "پیگیری سفارش",
};

export default function TrackOrderPage() {
  return <TrackOrderPageClient />;
}
