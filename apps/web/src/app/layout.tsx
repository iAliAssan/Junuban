import type { Metadata } from "next";
import "./globals.css";
import { UtilityBar } from "@/components/utility-bar/utility-bar";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";
import { CartProvider } from "@/components/cart/cart-provider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "جنوبان — محصولات اصیل جنوب ایران",
    template: "%s | جنوبان",
  },
  description:
    "خرید آنلاین خرما، ادویه، گیاهان دارویی و صنایع‌دستی اصیل جنوب ایران، مستقیم از تولیدکننده.",
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: "جنوبان",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Must be the first focusable element on every page. */}
        <a href="#main-content" className="skip-link">
          رفتن به محتوای اصلی
        </a>
        <CartProvider>
          <UtilityBar />
          <Header />
          <main id="main-content">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
