import type { Metadata } from "next";
import { AddressesPageClient } from "./addresses-page-client";

export const metadata: Metadata = {
  title: "آدرس‌های من",
  robots: { index: false },
};

export default function AddressesPage() {
  return <AddressesPageClient />;
}
