"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./product-gallery.module.css";

export function ProductGallery({
  images,
  productName,
}: {
  images: { url: string; altText: string }[];
  productName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  return (
    <div className={styles.gallery}>
      <div className={styles.mainImage}>
        {active ? (
          <Image src={active.url} alt={active.altText} fill sizes="(max-width: 1000px) 100vw, 50vw" priority />
        ) : (
          <div className={styles.placeholder} role="img" aria-label={`بدون تصویر برای ${productName}`}>
            بدون تصویر
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className={styles.thumbRow} role="tablist" aria-label="تصاویر محصول">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`تصویر ${i + 1} از ${images.length}`}
              className={`${styles.thumb} ${i === activeIndex ? styles.thumbActive : ""}`}
              onClick={() => setActiveIndex(i)}
            >
              <Image src={img.url} alt="" fill sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
