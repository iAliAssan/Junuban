import { resolveSelectedVariant, availableWeightOptionIds } from "./variant-selection";
import type { ProductDetail } from "./api";

function makeProduct(): Pick<ProductDetail, "producers"> {
  return {
    producers: [
      {
        productProducerId: "pp-minab",
        isDefault: true,
        producer: { slug: "minab-dates-co", name: "تعاونی خرمای میناب", region: "میناب", bio: null, verified: true },
        variants: [
          { id: "v1", sku: "MZF-MNB-250", price: 145000, weightOptionId: "w-250", weightLabel: "۲۵۰ گرم", grams: 250, availablePackages: 10 },
          { id: "v2", sku: "MZF-MNB-500", price: 260000, weightOptionId: "w-500", weightLabel: "۵۰۰ گرم", grams: 500, availablePackages: 5 },
        ],
      },
      {
        productProducerId: "pp-jahrom",
        isDefault: false,
        producer: { slug: "jahrom-farm", name: "باغ جهرم", region: "جهرم", bio: null, verified: true },
        // Jahrom only offers the 500g weight for this product.
        variants: [
          { id: "v3", sku: "MZF-JHR-500", price: 275000, weightOptionId: "w-500", weightLabel: "۵۰۰ گرم", grams: 500, availablePackages: 0 },
        ],
      },
    ],
  };
}

describe("resolveSelectedVariant", () => {
  it("defaults to the isDefault producer and its first variant when nothing is selected", () => {
    const { producer, variant } = resolveSelectedVariant(makeProduct(), null, null);
    expect(producer?.productProducerId).toBe("pp-minab");
    expect(variant?.id).toBe("v1");
  });

  it("selects the requested producer + weight combination", () => {
    const { producer, variant } = resolveSelectedVariant(makeProduct(), "pp-minab", "w-500");
    expect(producer?.productProducerId).toBe("pp-minab");
    expect(variant?.id).toBe("v2");
    expect(variant?.price).toBe(260000);
  });

  it("returns each producer's own independent price — never derived from another variant", () => {
    const minab500 = resolveSelectedVariant(makeProduct(), "pp-minab", "w-500").variant;
    const jahrom500 = resolveSelectedVariant(makeProduct(), "pp-jahrom", "w-500").variant;
    expect(minab500?.price).toBe(260000);
    expect(jahrom500?.price).toBe(275000);
    expect(minab500?.price).not.toBe(jahrom500?.price);
  });

  it("falls back to the producer's first variant when the requested weight isn't offered by that producer", () => {
    // Jahrom doesn't sell w-250 at all — should fall back to v3, not crash or silently pick a wrong price.
    const { variant } = resolveSelectedVariant(makeProduct(), "pp-jahrom", "w-250");
    expect(variant?.id).toBe("v3");
  });

  it("reflects zero availability honestly rather than hiding it", () => {
    const { variant } = resolveSelectedVariant(makeProduct(), "pp-jahrom", "w-500");
    expect(variant?.availablePackages).toBe(0);
  });

  it("returns nulls gracefully for a product with no producers", () => {
    const result = resolveSelectedVariant({ producers: [] }, null, null);
    expect(result).toEqual({ producer: null, variant: null });
  });
});

describe("availableWeightOptionIds", () => {
  it("returns only the weight ids the given producer actually sells", () => {
    const product = makeProduct();
    const jahrom = product.producers.find((p) => p.productProducerId === "pp-jahrom")!;
    expect(availableWeightOptionIds(jahrom)).toEqual(new Set(["w-500"]));
  });

  it("returns an empty set for a null producer", () => {
    expect(availableWeightOptionIds(null)).toEqual(new Set());
  });
});
