import Link from "next/link";
import styles from "./utility-bar.module.css";

export function UtilityBar() {
  return (
    <div className={styles.bar}>
      <div className={`container ${styles.inner}`}>
        <p className={styles.shipping}>ارسال به سراسر ایران</p>
        <ul className={styles.links}>
          <li>
            <Link href="/orders">سفارش‌های من</Link>
          </li>
          <li>
            <Link href="/producers">تولیدکنندگان</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
