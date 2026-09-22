"use client";

import Image from "next/image";
import { useState } from "react";
import { toPersianDigits } from "@/lib/format";
import styles from "./payment-card-display.module.css";

export interface PaymentCardDisplayData {
  number: string;
  holderName: string | null;
  bankName: string | null;
  photo: { url: string; altText: string } | null;
  adminNotes: string | null;
}

function formatCardNumber(number: string): string {
  return number.replace(/(.{4})/g, "$1 ").trim();
}

export function PaymentCardDisplay({ card }: { card: PaymentCardDisplayData }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(card.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — the
      // number is still visibly readable on screen either way, so this
      // is a convenience feature failing quietly, not a broken flow.
    }
  }

  return (
    <div className={styles.card}>
      {card.photo && (
        <div className={styles.imageWrap}>
          <Image src={card.photo.url} alt={card.photo.altText} fill sizes="320px" className={styles.image} />
        </div>
      )}

      <div className={styles.numberRow}>
        <span className={styles.number} dir="ltr">
          {toPersianDigits(formatCardNumber(card.number))}
        </span>
        <button type="button" className={styles.copyButton} onClick={handleCopy}>
          {copied ? "کپی شد" : "کپی"}
        </button>
      </div>

      {(card.holderName || card.bankName) && (
        <p className={styles.holderRow}>
          {card.holderName}
          {card.holderName && card.bankName ? " — " : ""}
          {card.bankName}
        </p>
      )}

      {card.adminNotes && <p className={styles.notes}>{card.adminNotes}</p>}
    </div>
  );
}
