"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./toast.module.css";

/**
 * Second reusable admin micro-interaction primitive introduced this
 * cycle (alongside ConfirmDialog) — for the "save/update feedback" and
 * "notifications" motion the master prompt asks Cycle 13 to establish
 * as a pattern, not a one-off. `aria-live="polite"` announces the
 * message to screen readers without stealing focus, since a toast must
 * never interrupt whatever the admin was doing to produce it.
 */
export function Toast({
  message,
  tone = "success",
  onDismiss,
}: {
  message: string | null;
  tone?: "success" | "error";
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!message || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.wrapper} role="status" aria-live="polite">
      <div className={`${styles.toast} ${tone === "error" ? styles.error : styles.success}`}>{message}</div>
    </div>,
    document.body,
  );
}
