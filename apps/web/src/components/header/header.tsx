"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import styles from "./header.module.css";
import { MenuIcon, CloseIcon, SearchIcon, UserIcon, BagIcon, ChevronIcon } from "../ui/icons";
import { useCart } from "../cart/cart-provider";

const NAV_LINKS = [
  { href: "/category/dates", label: "خرما و خشکبار" },
  { href: "/category/spices", label: "ادویه و گیاهان" },
  { href: "/category/handicrafts", label: "صنایع‌دستی" },
  { href: "/producers", label: "تولیدکنندگان" },
];

/**
 * The mobile drawer/scrim are rendered via a React portal directly into
 * `document.body`, deliberately NOT as descendants of <header>.
 *
 * Why: <header> has `backdrop-filter` for the frosted sticky-bar look.
 * Per the CSS Filter Effects spec, an element with a non-none
 * `backdrop-filter` (like `transform`/`filter`/`will-change`) establishes
 * a new containing block for its `position: fixed` descendants. That
 * means a fixed-position drawer nested inside <header> would resolve
 * `top`/`bottom` against the header's own (short, ~70px) box instead of
 * the viewport — visually the drawer's background box collapses to the
 * header's height while its flex content (nav links, footer) keeps
 * overflowing past it with no background behind it, so the page shows
 * through. This was a real, previously-reported bug — not a hypothetical
 * one — and increasing z-index alone would not have fixed it, since the
 * problem is the containing block, not the stacking order. Portalling to
 * `document.body` sidesteps the containing-block issue entirely.
 */
export function Header() {
  const { cart } = useCart();
  const cartCount = cart?.itemCount ?? 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Portals need a browser document; guard against the SSR pass.
  useEffect(() => setMounted(true), []);

  // Lock body scroll while the drawer is open, and always restore it —
  // including on unmount, so navigating away never leaves scroll locked.
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  function closeMenu(restoreFocus: boolean) {
    setMenuOpen(false);
    if (restoreFocus) menuToggleRef.current?.focus();
  }

  // Escape closes the drawer (restoring focus) and Tab is trapped inside it.
  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeMenu(true);
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
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
  }, [menuOpen]);

  const drawerPortal =
    mounted && menuOpen
      ? createPortal(
          <>
            <div className={styles.scrim} onClick={() => closeMenu(false)} aria-hidden="true" />
            <div
              ref={drawerRef}
              id="mobile-nav-drawer"
              className={`${styles.drawer} ${styles.drawerOpen}`}
              role="dialog"
              aria-modal="true"
              aria-label="منوی ناوبری"
            >
              <div className={styles.drawerHeader}>
                <span className={styles.logo}>جنوبان</span>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="بستن منو"
                  onClick={() => closeMenu(true)}
                >
                  <CloseIcon />
                </button>
              </div>

              <nav className={styles.drawerNav} aria-label="ناوبری موبایل">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={styles.drawerNavLink}
                    onClick={() => closeMenu(false)}
                  >
                    {link.label}
                    <ChevronIcon width={16} height={16} />
                  </Link>
                ))}
              </nav>

              <div className={styles.drawerFooter}>
                <Link href="/account" onClick={() => closeMenu(false)}>
                  حساب کاربری
                </Link>
                <Link href="/orders/track" onClick={() => closeMenu(false)}>
                  پیگیری سفارش
                </Link>
                <Link href="/about" onClick={() => closeMenu(false)}>
                  درباره ما
                </Link>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <button
          ref={menuToggleRef}
          type="button"
          className={`${styles.iconButton} ${styles.menuToggle}`}
          aria-label="باز کردن منو"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-drawer"
          onClick={() => setMenuOpen(true)}
        >
          <MenuIcon />
        </button>

        <Link href="/" className={styles.logo}>
          جنوبان
        </Link>

        <nav className={styles.nav} aria-label="ناوبری اصلی">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <div className={styles.searchPill} role="search">
            <SearchIcon width={16} height={16} />
            <label className="visually-hidden" htmlFor="header-search">
              جست‌وجوی محصول، تولیدکننده یا منطقه
            </label>
            <input
              id="header-search"
              type="search"
              placeholder="جست‌وجوی محصول، تولیدکننده یا منطقه..."
              className={styles.searchPillInput}
            />
          </div>

          <button
            type="button"
            className={`${styles.iconButton} ${styles.searchOnlyMobile}`}
            aria-label="جست‌وجو"
            aria-expanded={searchOpen}
            aria-controls="mobile-search-reveal"
            onClick={() => setSearchOpen((v) => !v)}
          >
            <SearchIcon />
          </button>

          <Link href="/account" className={styles.iconButton} aria-label="حساب کاربری">
            <UserIcon />
          </Link>

          <Link href="/cart" className={styles.iconButton} aria-label={`سبد خرید، ${cartCount} کالا`}>
            <BagIcon />
            {cartCount > 0 && (
              <span className={styles.badge} aria-hidden="true">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {searchOpen && (
        <div id="mobile-search-reveal" className={styles.searchReveal}>
          <div className="container">
            <label className="visually-hidden" htmlFor="mobile-search">
              جست‌وجوی محصول، تولیدکننده یا منطقه
            </label>
            <input
              id="mobile-search"
              type="search"
              className={styles.searchRevealInput}
              placeholder="جست‌وجوی محصول، تولیدکننده یا منطقه..."
              autoFocus
            />
          </div>
        </div>
      )}

      {drawerPortal}
    </header>
  );
}
