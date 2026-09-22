"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentAdmin, adminAuthApi, type AuthenticatedAdmin } from "@/lib/admin-auth-client";
import {
  MenuIcon,
  CloseIcon,
  GridIcon,
  ClipboardListIcon,
  ActivityIcon,
  LogoutIcon,
  BoxIcon,
  TagIcon,
  UsersIcon,
  GiftIcon,
  CreditCardIcon,
} from "../ui/icons";
import { ADMIN_NAV_ITEMS } from "./admin-nav-items";
import styles from "./admin-shell.module.css";

const NAV_ICONS = {
  grid: GridIcon,
  clipboard: ClipboardListIcon,
  activity: ActivityIcon,
  box: BoxIcon,
  tag: TagIcon,
  users: UsersIcon,
  gift: GiftIcon,
  card: CreditCardIcon,
} as const;

const ADMIN_ROLE_LABELS: Record<AuthenticatedAdmin["role"], string> = {
  OWNER: "مالک فروشگاه",
  STAFF: "کارمند",
};

/**
 * Wraps every protected page under /admin. Centralizes the one auth
 * check (rather than each page re-implementing its own useEffect
 * redirect, which was the customer-side `AccountPageClient` pattern —
 * fine for one page, but would mean copy-pasting the same guard into
 * every admin route here). Renders nothing of the real UI until the
 * session check resolves, so a not-yet-authenticated flash of admin
 * content never appears.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AuthenticatedAdmin | null | "loading">("loading");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    getCurrentAdmin().then((a) => {
      setAdmin(a);
      if (!a) {
        router.replace(`/admin/login?redirect=${encodeURIComponent(pathname || "/admin")}`);
      }
    });
    // Deliberately excludes `pathname` from deps — this check must only
    // run once per mount (page load / hard navigation), not on every
    // client-side nav within /admin, or a session that's still valid
    // would get needlessly re-checked on every link click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Close the mobile drawer automatically on route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  function closeDrawer(restoreFocus: boolean) {
    setDrawerOpen(false);
    if (restoreFocus) menuToggleRef.current?.focus();
  }

  useEffect(() => {
    if (!drawerOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeDrawer(true);
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  async function handleLogout() {
    await adminAuthApi.logout().catch(() => {});
    router.push("/admin/login");
    router.refresh();
  }

  if (admin === "loading" || !admin) {
    return (
      <div className={styles.loadingScreen}>
        <p role="status">در حال بررسی نشست ورود...</p>
      </div>
    );
  }

  const visibleNavItems = ADMIN_NAV_ITEMS.filter((item) => !item.requiresRole || item.requiresRole === admin.role);

  const navList = (onNavigate?: () => void) => (
    <nav className={styles.nav} aria-label="ناوبری پنل مدیریت">
      {visibleNavItems.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon width={18} height={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const drawerPortal =
    mounted && drawerOpen
      ? createPortal(
          <>
            <div className={styles.scrim} onClick={() => closeDrawer(false)} aria-hidden="true" />
            <div
              ref={drawerRef}
              id="admin-nav-drawer"
              className={styles.drawer}
              role="dialog"
              aria-modal="true"
              aria-label="منوی پنل مدیریت"
            >
              <div className={styles.drawerHeader}>
                <span className={styles.logo}>پنل مدیریت جنوبان</span>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="بستن منو"
                  onClick={() => closeDrawer(true)}
                >
                  <CloseIcon />
                </button>
              </div>
              {navList(() => closeDrawer(false))}
              <div className={styles.drawerFooter}>
                <p className={styles.roleLabel}>{ADMIN_ROLE_LABELS[admin.role]}</p>
                <p className={styles.emailLabel}>{admin.email}</p>
                <button type="button" className={styles.logoutButton} onClick={handleLogout}>
                  <LogoutIcon width={18} height={18} />
                  خروج از حساب
                </button>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logo}>پنل مدیریت جنوبان</span>
        </div>
        {navList()}
        <div className={styles.sidebarFooter}>
          <p className={styles.roleLabel}>{ADMIN_ROLE_LABELS[admin.role]}</p>
          <p className={styles.emailLabel}>{admin.email}</p>
          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            <LogoutIcon width={18} height={18} />
            خروج از حساب
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            ref={menuToggleRef}
            type="button"
            className={`${styles.iconButton} ${styles.menuToggle}`}
            aria-label="باز کردن منو"
            aria-expanded={drawerOpen}
            aria-controls="admin-nav-drawer"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon />
          </button>
          <span className={styles.topbarTitle}>پنل مدیریت جنوبان</span>
        </header>

        <main id="admin-main-content" className={styles.content}>
          {children}
        </main>
      </div>

      {drawerPortal}
    </div>
  );
}
