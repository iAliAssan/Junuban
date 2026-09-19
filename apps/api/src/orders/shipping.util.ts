export interface ShippingConfig {
  flatRateToman: number;
  freeThresholdToman?: number;
  freeEnabled: boolean;
}

/** Flat-rate shipping with an optional free-shipping threshold — the only shipping model this cycle supports (see locked spec §12). */
export function calculateShippingCost(subtotal: number, config: ShippingConfig): number {
  if (config.freeEnabled && config.freeThresholdToman !== undefined && subtotal >= config.freeThresholdToman) {
    return 0;
  }
  return config.flatRateToman;
}
