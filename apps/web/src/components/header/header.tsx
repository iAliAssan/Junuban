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
  // Stays true for one extra transition-duration after menuOpen flips
  // to false, so the drawer remains mounted long enough for its CLOSING
  // transition to actually play (see the `.drawer`/`.drawerOpen` CSS —
  // the transition rule already existed for opening, but the element
  // was previously unmounted in the very same render as menuOpen
  // becoming false, so the browser never got a frame in which
  // `.drawerOpen` was removed while the element still existed to
  // transition from). DRAWER_TRANSITION_MS must match the CSS
  // transition-duration on `.drawer` exactly, or this will either cut
  // the animation off early or leave a dead interactive drawer sitting
  // invisibly in the DOM for longer than needed.
  const [drawerRendered, setDrawerRendered] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const DRAWER_TRANSITION_MS = 280;

  // Portals need a browser document; guard against the SSR pass.
  useEffect(() => setMounted(true), []);

  function openMenu() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setDrawerRendered(true);
    // Rendered in an unopened state first, then flipped to open on the
    // next frame — this two-step is what gives the browser a state to
    // transition FROM (translateX(102%)) before it transitions TO
    // (translateX(0)); setting both in the same render would skip
    // straight to the open state with no visible motion at all, the
    // mirror-image of the closing bug this whole change fixes.
    requestAnimationFrame(() => setMenuOpen(true));
  }

  // Lock body scroll while the drawer is open or animating closed —
  // NOT just `menuOpen`, or the page would become scrollable again
  // mid-close-animation, which reads as the drawer floating over
  // content that's shifting underneath it.
  useEffect(() => {
    if (!drawerRendered) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerRendered]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  function closeMenu(restoreFocus: boolean) {
    setMenuOpen(false);
    closeTimeoutRef.current = setTimeout(() => setDrawerRendered(false), DRAWER_TRANSITION_MS);
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
    mounted && drawerRendered
      ? createPortal(
          <>
            <div className={`${styles.scrim} ${menuOpen ? styles.scrimOpen : ""}`} onClick={() => closeMenu(false)} aria-hidden="true" />
            <div
              ref={drawerRef}
              id="mobile-nav-drawer"
              className={`${styles.drawer} ${menuOpen ? styles.drawerOpen : ""}`}
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
                <Link href="/orders" onClick={() => closeMenu(false)}>
                  سفارش‌های من
                </Link>
                <Link href="/producers" onClick={() => closeMenu(false)}>
                  تولیدکنندگان
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
          onClick={openMenu}
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
