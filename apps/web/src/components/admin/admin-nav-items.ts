import type { AdminRole } from "@/lib/admin-auth-client";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: "grid" | "clipboard" | "activity" | "box" | "tag" | "users" | "gift";
  /** When set, only this role can see/use the item (server also enforces this — see AdminOwnerGuard). */
  requiresRole?: AdminRole;
}

/**
 * A nav entry whose backend/frontend capability doesn't exist yet must
 * not be shown as a fake, clickable dead end (see master prompt §6/§21
 * on no fake controls). Products, Categories, Producers, and Packaging
 * Options now all have real admin APIs
 * (AdminProductsController/AdminCategoriesController/
 * AdminProducersController/AdminPackagingOptionsController) and real
 * admin UI, so all four are listed. Categories/producers/packaging
 * options are placed right after Products since they are the reference
 * data the product form's dropdowns and the checkout packaging picker
 * depend on.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "داشبورد", icon: "grid" },
  { href: "/admin/products", label: "محصولات", icon: "box" },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: "tag" },
  { href: "/admin/producers", label: "تولیدکنندگان", icon: "users" },
  { href: "/admin/packaging-options", label: "گزینه‌های بسته‌بندی", icon: "gift" },
  { href: "/admin/orders", label: "سفارش‌ها", icon: "clipboard" },
  { href: "/admin/activity-log", label: "فعالیت‌های اخیر", icon: "activity", requiresRole: "OWNER" },
];
