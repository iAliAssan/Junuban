"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./confirm-dialog.module.css";

/**
 * First reusable admin dialog primitive (Cycle 13 — the master prompt
 * explicitly asks this cycle to "establish the animation/micro-
 * interaction patterns that can later be reused across the rest of the
 * admin panel"). Focus trapping / Escape / focus-restoration logic is
 * deliberately the same shape as AdminShell's mobile nav drawer rather
 * than a reinvented variant, so the two reusable patterns this admin
 * panel now has (drawer, dialog) behave identically to a keyboard user.
 *
 * Deliberately non-generic beyond confirm/cancel — a future cycle
 * introducing a full form modal should build that as its own component
 * (or extend this one) rather than stretching this one prop surface to
 * cover both cases.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "انصراف",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.scrim} onClick={onCancel} aria-hidden="true">
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-description" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h2>
        {description && (
          <p id="confirm-dialog-description" className={styles.description}>
            {description}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={destructive ? styles.destructiveButton : styles.confirmButton}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "در حال انجام..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
