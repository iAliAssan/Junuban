"use client";

import styles from "./quantity-stepper.module.css";
import { toPersianDigits } from "@/lib/format";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

export function QuantityStepper({
  quantity,
  onChange,
  disabled,
  label,
}: {
  quantity: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.button}
        disabled={disabled || quantity <= MIN_QUANTITY}
        aria-label="کاهش تعداد"
        onClick={() => onChange(Math.max(MIN_QUANTITY, quantity - 1))}
      >
        −
      </button>
      <span className={styles.value} aria-live="polite">
        {toPersianDigits(quantity)}
      </span>
      <button
        type="button"
        className={styles.button}
        disabled={disabled || quantity >= MAX_QUANTITY}
        aria-label="افزایش تعداد"
        onClick={() => onChange(Math.min(MAX_QUANTITY, quantity + 1))}
      >
        +
      </button>
    </div>
  );
}
