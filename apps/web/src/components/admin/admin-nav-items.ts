import type { AdminRole } from "@/lib/admin-auth-client";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: "grid" | "clipboard" | "activity" | "box" | "tag" | "users" | "gift" | "card";
  /** When set, only this role can see/use the item (server also enforces this — see AdminOwnerGuard). */
  requiresRole?: AdminRole;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "داشبورد", icon: "grid" },
  { href: "/admin/products", label: "محصولات", icon: "box" },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: "tag" },
  { href: "/admin/producers", label: "تولیدکنندگان", icon: "users" },
  { href: "/admin/packaging-options", label: "گزینه‌های بسته‌بندی", icon: "gift" },
  { href: "/admin/orders", label: "سفارش‌ها", icon: "clipboard" },
  { href: "/admin/settings/payment", label: "تنظیمات پرداخت", icon: "card", requiresRole: "OWNER" },
  { href: "/admin/activity-log", label: "فعالیت‌های اخیر", icon: "activity", requiresRole: "OWNER" },
];
