import type { Metadata } from "next";
import { CartPageClient } from "./cart-page-client";

export const metadata: Metadata = {
  title: "سبد خرید",
  alternates: { canonical: "/cart" },
  robots: { index: false }, // a personal cart has no SEO value and shouldn't be indexed
};

export default function CartPage() {
  return <CartPageClient />;
}
