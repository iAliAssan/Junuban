/**
 * Development/demo seed data for Junubân.
 *
 * This data is NOT production content — names, bios, and stock numbers
 * below are illustrative placeholders for local development only.
 * Product photos use placehold.co generated placeholders, not real
 * product photography.
 *
 * Run with: npm run prisma:seed -w apps/api
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

function placeholderImage(label: string, bg: string): string {
  return `https://placehold.co/800x800/${bg}/ffffff/png?text=${encodeURIComponent(label)}`;
}

async function main() {
  console.log("Seeding development data…");

  // ---- Admin (owner) ----------------------------------------------------
  const ownerPasswordHash = await hash("ChangeMe123!"); // dev-only credential
  await prisma.adminUser.upsert({
    where: { email: "owner@junuban.dev" },
    update: {},
    create: {
      email: "owner@junuban.dev",
      passwordHash: ownerPasswordHash,
      fullName: "مالک فروشگاه (Dev)",
      role: "OWNER",
    },
  });

  // ---- Site settings (single row) ---------------------------------------
  const existingSettings = await prisma.siteSettings.findFirst();
  if (!existingSettings) {
    await prisma.siteSettings.create({
      data: {
        storeName: "جنوبان",
        contactEmail: "hello@junuban.dev",
        contactPhone: "02100000000",
        flatShippingRate: 350000,
        freeShippingEnabled: true,
        freeShippingThreshold: 2000000,
        statProducerCount: 5,
        statProvinceCount: 2,
        statSatisfactionScore: 4.8,
        homepagePromoTitle: "جعبه‌های هدیه فصل برداشت",
        homepagePromoBody: "گلچینی از بهترین محصولات جنوب، در یک بسته.",
      },
    });
  }

  // ---- Content pages ------------------------------------------------------
  for (const slug of ["about", "shipping-returns", "authenticity", "guide"]) {
    await prisma.contentPage.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title: `صفحه ${slug} (پیش‌نویس توسعه)`,
        body: "این محتوا نمونه‌ی توسعه است و باید توسط مدیر فروشگاه ویرایش شود.",
      },
    });
  }

  // ---- Categories ---------------------------------------------------------
  const categoryDefs = [
    { slug: "dates", name: "خرما و خشکبار", iconKey: "date" },
    { slug: "spices", name: "ادویه و گیاهان", iconKey: "spice" },
    { slug: "handicrafts", name: "صنایع‌دستی", iconKey: "craft" },
    { slug: "gift-boxes", name: "جعبه‌های هدیه", iconKey: "gift" },
  ];
  const categories = await Promise.all(
    categoryDefs.map((c, i) =>
      prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: { ...c, sortOrder: i } }),
    ),
  );
  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  // ---- Producers ------------------------------------------------------------
  const producerDefs = [
    { slug: "minab-dates-co", name: "تعاونی خرمای میناب", region: "میناب، هرمزگان", province: "هرمزگان", verified: true, bio: "تعاونی خانوادگی با بیش از سه دهه تجربه در کاشت و بسته‌بندی خرمای مضافتی." },
    { slug: "jahrom-farm", name: "باغ جهرم", region: "جهرم، فارس", province: "فارس", verified: true, bio: "نخلستان خانوادگی در جهرم، تولیدکننده خرمای مضافتی و پیارم با روش‌های سنتی." },
    { slug: "qeshm-herbs", name: "گیاهان قشم", region: "قشم، هرمزگان", province: "هرمزگان", verified: false, bio: "جمع‌آوری و خشک‌کردن گیاهان دارویی بومی جزیره قشم." },
    { slug: "bandar-abbas-spice-house", name: "خانه ادویه بندرعباس", region: "بندرعباس، هرمزگان", province: "هرمزگان", verified: true, bio: "تامین‌کننده زعفران و ادویه‌جات معطر جنوب کشور." },
    { slug: "hormoz-crafts", name: "صنایع‌دستی هرمز", region: "جزیره هرمز، هرمزگان", province: "هرمزگان", verified: true, bio: "بافت سبد و صنایع‌دستی از برگ نخل توسط هنرمندان جزیره هرمز." },
  ];
  const producers = await Promise.all(
    producerDefs.map((p) => prisma.producer.upsert({ where: { slug: p.slug }, update: {}, create: p })),
  );
  const producerBySlug = Object.fromEntries(producers.map((p) => [p.slug, p]));

  // Producer profile photos (Media, 1:1 relation)
  for (const p of producers) {
    await prisma.media.upsert({
      where: { producerId: p.id },
      update: {},
      create: {
        producerId: p.id,
        url: placeholderImage(p.name, "8f3d22"),
        altText: `تصویر ${p.name}`,
      },
    });
  }

  // ---- Packaging options -----------------------------------------------
  // `name` has no unique constraint in the schema (packaging is free-text,
  // admin-managed), so this is a manual find-or-create rather than upsert.
  for (const p of [
    { name: "بسته‌بندی استاندارد", priceDelta: 0, sortOrder: 0 },
    { name: "جعبه هدیه", priceDelta: 45000, sortOrder: 1 },
  ]) {
    const existing = await prisma.packagingOption.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.packagingOption.create({ data: p });
    }
  }

  /**
   * Creates a product with one or more (producer, onHandGrams, reservedGrams,
   * prices-by-gram) entries and a shared set of weight options. Kept as a
   * local helper so the six products below stay readable — not a
   * production abstraction, just seed-script ergonomics.
   */
  async function seedProduct(opts: {
    slug: string;
    name: string;
    description: string;
    categorySlug: keyof typeof categoryBySlug;
    harvestSeason?: string;
    imageBg: string;
    weights: { label: string; grams: number }[];
    producers: {
      producerSlug: keyof typeof producerBySlug;
      isDefault?: boolean;
      onHandGrams: number;
      reservedGrams?: number;
      pricesByGrams: Record<number, number>;
      skuPrefix: string;
    }[];
  }) {
    const category = categoryBySlug[opts.categorySlug];
    const product = await prisma.product.upsert({
      where: { slug: opts.slug },
      update: { harvestSeason: opts.harvestSeason ?? null },
      create: {
        slug: opts.slug,
        name: opts.name,
        description: opts.description,
        categoryId: category.id,
        type: "SIMPLE",
        status: "ACTIVE",
        harvestSeason: opts.harvestSeason,
        metaTitle: `خرید ${opts.name} اصل جنوب`,
        metaDescription: opts.description,
      },
    });

    const weightOptions = await Promise.all(
      opts.weights.map((w, i) =>
        prisma.weightOption.upsert({
          where: { productId_grams: { productId: product.id, grams: w.grams } },
          update: {},
          create: { productId: product.id, label: w.label, grams: w.grams, sortOrder: i },
        }),
      ),
    );

    const existingMedia = await prisma.media.findFirst({ where: { productId: product.id } });
    if (!existingMedia) {
      await prisma.media.create({
        data: {
          productId: product.id,
          url: placeholderImage(opts.name, opts.imageBg),
          altText: `تصویر ${opts.name}`,
          sortOrder: 0,
        },
      });
    }

    for (const producerDef of opts.producers) {
      const producer = producerBySlug[producerDef.producerSlug];
      const link = await prisma.productProducer.upsert({
        where: { productId_producerId: { productId: product.id, producerId: producer.id } },
        update: {},
        create: { productId: product.id, producerId: producer.id, isDefault: producerDef.isDefault ?? false },
      });

      await prisma.inventory.upsert({
        where: { productProducerId: link.id },
        update: { onHandGrams: producerDef.onHandGrams, reservedGrams: producerDef.reservedGrams ?? 0 },
        create: {
          productProducerId: link.id,
          onHandGrams: producerDef.onHandGrams,
          reservedGrams: producerDef.reservedGrams ?? 0,
          lowStockThresholdGrams: 2000,
        },
      });

      for (const w of weightOptions) {
        const price = producerDef.pricesByGrams[w.grams];
        if (price === undefined) continue; // this producer doesn't offer this weight
        await prisma.variant.upsert({
          where: { productProducerId_weightOptionId: { productProducerId: link.id, weightOptionId: w.id } },
          update: { price },
          create: {
            productProducerId: link.id,
            weightOptionId: w.id,
            price,
            sku: `${producerDef.skuPrefix}-${w.grams}`,
          },
        });
      }
    }

    return product;
  }

  // 1) خرمای مضافتی — two producers, three weights, healthy stock.
  await seedProduct({
    slug: "mozafati-date",
    name: "خرمای مضافتی",
    description: "خرمای مضافتی تازه، برداشت مستقیم از نخلستان‌های جنوب، نرم و آبدار.",
    categorySlug: "dates",
    harvestSeason: "برداشت پاییز ۱۴۰۳",
    imageBg: "8f3d22",
    weights: [
      { label: "۲۵۰ گرم", grams: 250 },
      { label: "۵۰۰ گرم", grams: 500 },
      { label: "۱ کیلوگرم", grams: 1000 },
    ],
    producers: [
      {
        producerSlug: "minab-dates-co",
        isDefault: true,
        onHandGrams: 40000,
        pricesByGrams: { 250: 145000, 500: 260000, 1000: 480000 },
        skuPrefix: "MZF-MNB",
      },
      {
        producerSlug: "jahrom-farm",
        onHandGrams: 25000,
        pricesByGrams: { 250: 155000, 500: 275000, 1000: 510000 },
        skuPrefix: "MZF-JHR",
      },
    ],
  });

  // 2) خرمای پیارم — single producer, two weights.
  await seedProduct({
    slug: "piarom-date",
    name: "خرمای پیارم",
    description: "خرمای پیارم ممتاز، خشک و کشیده، از نخلستان‌های جهرم.",
    categorySlug: "dates",
    harvestSeason: "برداشت پاییز ۱۴۰۳",
    imageBg: "5c2c15",
    weights: [
      { label: "۵۰۰ گرم", grams: 500 },
      { label: "۱ کیلوگرم", grams: 1000 },
    ],
    producers: [
      {
        producerSlug: "jahrom-farm",
        isDefault: true,
        onHandGrams: 15000,
        pricesByGrams: { 500: 420000, 1000: 790000 },
        skuPrefix: "PRM-JHR",
      },
    ],
  });

  // 3) زعفران سرگل — single producer, small weights, intentionally LOW stock.
  await seedProduct({
    slug: "sargol-saffron",
    name: "زعفران سرگل",
    description: "زعفران سرگل درجه یک، معطر و پرقدرت، بسته‌بندی شده در بندرعباس.",
    categorySlug: "spices",
    imageBg: "a85a1e",
    weights: [
      { label: "۵ گرم", grams: 5 },
      { label: "۱۰ گرم", grams: 10 },
    ],
    producers: [
      {
        producerSlug: "bandar-abbas-spice-house",
        isDefault: true,
        onHandGrams: 22, // only ~4 packages of 5g left → low-stock in UI
        pricesByGrams: { 5: 890000, 10: 1690000 },
        skuPrefix: "SAF-BND",
      },
    ],
  });

  // 4) لیمو عمانی — single producer, intentionally OUT of stock.
  await seedProduct({
    slug: "omani-dried-lime",
    name: "لیمو عمانی خشک",
    description: "لیموی عمانی خشک‌شده به روش سنتی، مناسب خورش و دمنوش.",
    categorySlug: "spices",
    imageBg: "5a6448",
    weights: [{ label: "۲۵۰ گرم", grams: 250 }],
    producers: [
      {
        producerSlug: "qeshm-herbs",
        isDefault: true,
        onHandGrams: 0, // out of stock — exercises the empty/unavailable UI state
        pricesByGrams: { 250: 65000 },
        skuPrefix: "LOOMI-QSHM",
      },
    ],
  });

  // 5) سبد بافت برگ نخل — handicraft; "weight" here is the item's real
  // shipping weight (a single woven basket), not a consumable ingredient.
  await seedProduct({
    slug: "palm-leaf-basket",
    name: "سبد بافت برگ نخل",
    description: "سبد دست‌بافت از برگ نخل، ساخته‌شده توسط هنرمندان جزیره هرمز.",
    categorySlug: "handicrafts",
    imageBg: "8a5a2c",
    weights: [{ label: "یک عدد", grams: 400 }],
    producers: [
      {
        producerSlug: "hormoz-crafts",
        isDefault: true,
        onHandGrams: 8000, // 20 baskets
        pricesByGrams: { 400: 385000 },
        skuPrefix: "BASKET-HRMZ",
      },
    ],
  });

  // 6) جعبه هدیه جنوب — gift-boxes category, two producers for variety.
  await seedProduct({
    slug: "southern-gift-box",
    name: "جعبه هدیه جنوب",
    description: "گلچینی از خرمای مضافتی، زعفران و صنایع‌دستی جنوب در یک بسته هدیه.",
    categorySlug: "gift-boxes",
    imageBg: "b5502e",
    weights: [
      { label: "بسته کوچک", grams: 800 },
      { label: "بسته بزرگ", grams: 1500 },
    ],
    producers: [
      {
        producerSlug: "minab-dates-co",
        isDefault: true,
        onHandGrams: 12000,
        pricesByGrams: { 800: 690000, 1500: 1190000 },
        skuPrefix: "GIFT-MNB",
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Dev admin login: owner@junuban.dev / ChangeMe123!  (LOCAL DEV ONLY — never use in production)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
