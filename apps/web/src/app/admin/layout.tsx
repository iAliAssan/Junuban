import type { Metadata } from "next";
import "./admin.css";

/**
 * Admin gets its OWN root layout, entirely separate from the
 * storefront's (`app/(storefront)/layout.tsx`). This is the documented
 * Next.js App Router pattern for "a section with a completely
 * different UI" (multiple root layouts via route groups) — the
 * storefront routes were moved into an `(storefront)` route group
 * specifically so `/admin` could sit as an independent top-level
 * segment with its own `<html>`/`<body>`, rather than unavoidably
 * nesting inside the storefront's `Header`/`Footer`/`CartProvider`.
 * `robots.ts` and `sitemap.ts` deliberately stayed at the `app/` root
 * (not moved into the route group) — Next.js requires `robots.ts` to
 * stay there, and it already disallows crawling `/admin`.
 *
 * `noindex` is set directly here as a second, redundant layer on top
 * of `robots.ts`'s disallow rule — defense in depth for an admin
 * surface that should never appear in search results.
 */
export const metadata: Metadata = {
  title: { default: "پنل مدیریت جنوبان", template: "%s | پنل مدیریت جنوبان" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
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
      <body className="admin-body">
        <a href="#admin-main-content" className="skip-link">
          رفتن به محتوای اصلی
        </a>
        {children}
      </body>
    </html>
  );
}
