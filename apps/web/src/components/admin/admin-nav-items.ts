import type { AdminRole } from "@/lib/admin-auth-client";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: "grid" | "clipboard" | "activity";
  /** When set, only this role can see/use the item (server also enforces this — see AdminOwnerGuard). */
  requiresRole?: AdminRole;
}

/**
 * Deliberately short. Per Cycle 8's master prompt (§6): a nav entry
 * whose backend/frontend capability doesn't exist yet must not be
 * shown as a fake, clickable dead end. Products, categories,
 * producers, and inventory management all have real Prisma models but
 * NO admin API endpoints yet (verified against the actual
 * `apps/api/src/**` controllers before writing this file) — they stay
 * out of this list entirely until a future cycle adds the backend
 * they'd need to call. Add each one here in the same cycle its API
 * lands, not before.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "داشبورد", icon: "grid" },
  { href: "/admin/orders", label: "سفارش‌ها", icon: "clipboard" },
  { href: "/admin/activity-log", label: "فعالیت‌های اخیر", icon: "activity", requiresRole: "OWNER" },
];
