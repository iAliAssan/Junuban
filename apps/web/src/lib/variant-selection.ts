import type { ProductDetail, ProductProducerDetail, ProductVariantDetail } from "./api";

export interface VariantSelection {
  producer: ProductProducerDetail | null;
  variant: ProductVariantDetail | null;
}

/**
 * Given the full product detail payload and a chosen (productProducerId,
 * weightOptionId) pair, returns the matching producer + variant. Falls
 * back to the default producer (or the first one) and, within it, the
 * first variant, when no explicit selection has been made yet — this is
 * what the PDP shows on first render before the shopper touches anything.
 *
 * Deliberately does no price math: the returned variant's `price` is
 * read directly from the API response, never derived from another
 * variant (see master prompt §7 — no per-kilogram formula).
 */
export function resolveSelectedVariant(
  product: Pick<ProductDetail, "producers">,
  selectedProductProducerId: string | null,
  selectedWeightOptionId: string | null,
): VariantSelection {
  const producer =
    product.producers.find((p) => p.productProducerId === selectedProductProducerId) ??
    product.producers.find((p) => p.isDefault) ??
    product.producers[0] ??
    null;

  if (!producer || producer.variants.length === 0) {
    return { producer, variant: null };
  }

  const variant =
    producer.variants.find((v) => v.weightOptionId === selectedWeightOptionId) ??
    producer.variants[0] ??
    null;

  return { producer, variant };
}

/**
 * Weight options a given producer actually offers, in the product's
 * canonical weight order. Used to disable/hide weight choices that the
 * currently-selected producer doesn't sell (not every producer offers
 * every weight — see seed data: some products have per-producer subsets).
 */
export function availableWeightOptionIds(producer: ProductProducerDetail | null): Set<string> {
  return new Set((producer?.variants ?? []).map((v) => v.weightOptionId));
}
