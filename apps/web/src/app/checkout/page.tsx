import type { Metadata } from "next";
import { CheckoutPageClient } from "./checkout-page-client";

export const metadata: Metadata = {
  title: "تکمیل خرید",
  robots: { index: false },
};

export default function CheckoutPage() {
  return <CheckoutPageClient />;
}
