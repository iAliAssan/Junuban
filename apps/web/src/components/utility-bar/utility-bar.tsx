import Link from "next/link";
import styles from "./utility-bar.module.css";

export function UtilityBar() {
  return (
    <div className={styles.bar}>
      <div className={`container ${styles.inner}`}>
        <p className={styles.shipping}>ارسال به سراسر ایران — تحویل ۲ تا ۴ روز کاری</p>
        <ul className={styles.links}>
          <li>
            <Link href="/orders/track">پیگیری سفارش</Link>
          </li>
          <li>
            <Link href="/about">درباره ما</Link>
          </li>
          <li>
            <Link href="/contact">تماس با ما</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
