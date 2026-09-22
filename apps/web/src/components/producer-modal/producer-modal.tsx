"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import styles from "./producer-modal.module.css";
import { CloseIcon } from "@/components/ui/icons";
import type { ProductProducerDetail } from "@/lib/api";

export function ProducerModal({
  open,
  producers,
  onClose,
}: {
  open: boolean;
  producers: ProductProducerDetail[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
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
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className={styles.scrim} onClick={onClose} aria-hidden="true">
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="همه تولیدکنندگان"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>تولیدکنندگان این محصول</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="بستن"
          >
            <CloseIcon />
          </button>
        </div>

        <div className={styles.track} style={{ transform: `translateX(${activeIndex * 100}%)` }}>
          {producers.map((p) => (
            <div key={p.productProducerId} className={styles.slide}>
              <div className={styles.photoWrap}>
                {p.producer.photo ? (
                  <Image src={p.producer.photo.url} alt="" fill sizes="320px" className={styles.photo} />
                ) : (
                  <span className={styles.photoFallback} aria-hidden="true">
                    {p.producer.name.charAt(0)}
                  </span>
                )}
              </div>
              <p className={styles.name}>
                {p.producer.name}
                {p.producer.verified && (
                  <span className={styles.verifiedBadge} title="تایید شده" aria-label="تولیدکننده تایید شده">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="4 12 9 17 20 6" />
                    </svg>
                  </span>
                )}
              </p>
              <p className={styles.region}>{p.producer.region}</p>
              {p.producer.bio && <p className={styles.bio}>{p.producer.bio}</p>}
            </div>
          ))}
        </div>

        {producers.length > 1 && (
          <div className={styles.dots} role="tablist" aria-label="انتخاب تولیدکننده">
            {producers.map((p, i) => (
              <button
                key={p.productProducerId}
                type="button"
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={`تولیدکننده ${i + 1} از ${producers.length}`}
                className={`${styles.dot} ${i === activeIndex ? styles.dotActive : ""}`}
                onClick={() => setActiveIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
