/**
 * Available packages of a given weight variant, derived from bulk grams
 * on hand minus grams already reserved (see InventoryReservation).
 * Never negative, always an integer number of packages.
 */
export function availablePackages(onHandGrams: number, reservedGrams: number, weightGrams: number): number {
  if (weightGrams <= 0) return 0;
  const availableGrams = Math.max(0, onHandGrams - reservedGrams);
  return Math.floor(availableGrams / weightGrams);
}

/** Grams consumed when ordering `quantity` packages of a given weight. */
export function gramsForOrder(weightGrams: number, quantity: number): number {
  return weightGrams * quantity;
}
