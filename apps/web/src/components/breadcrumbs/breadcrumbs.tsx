import Link from "next/link";
import styles from "./breadcrumbs.module.css";

export interface BreadcrumbItem {
  label: string;
  href?: string; // omitted for the current (last) page
}

export function Breadcrumbs({ items, baseUrl }: { items: BreadcrumbItem[]; baseUrl: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${baseUrl}${item.href}` } : {}),
    })),
  };

  return (
    <nav className={styles.breadcrumbs} aria-label="مسیر صفحه">
      <div className="container">
        <ol className={styles.list}>
          {items.map((item, i) => (
            <li key={i}>
              {item.href ? <Link href={item.href}>{item.label}</Link> : <span className={styles.current}>{item.label}</span>}
              {i < items.length - 1 && <span aria-hidden="true">/</span>}
            </li>
          ))}
        </ol>
      </div>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </nav>
  );
}
