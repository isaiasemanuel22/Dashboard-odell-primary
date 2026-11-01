export type PriceRoundTo = 0 | 100 | 500;

/** Markup sobre el costo: (precio − costo) ÷ costo × 100. Null si cost <= 0. */
export function productMarkupPercent(
  price: number,
  cost: number,
): number | null {
  const safeCost = Number(cost);
  if (!Number.isFinite(safeCost) || safeCost <= 0) {
    return null;
  }
  const safePrice = Number(price);
  if (!Number.isFinite(safePrice)) {
    return null;
  }
  return ((safePrice - safeCost) / safeCost) * 100;
}

/**
 * Precio de lista para alcanzar el markup objetivo, redondeado hacia arriba
 * al múltiplo `roundTo` (por defecto 100).
 */
export function priceForTargetMarkup(
  cost: number,
  targetPercent: number,
  roundTo = 100,
): number {
  const safeCost = Number(cost) || 0;
  const target = Number(targetPercent) || 0;
  const raw = safeCost * (1 + target / 100);
  return roundPrice(raw, roundTo as PriceRoundTo);
}

/** Redondeo hacia arriba a múltiplos de 100/500; 0 = sin redondeo por escalón. */
export function roundPrice(value: number, roundTo: PriceRoundTo): number {
  const safe = Number(value);
  if (!Number.isFinite(safe)) {
    return 0;
  }
  if (roundTo === 0) {
    return safe;
  }
  return Math.ceil(safe / roundTo) * roundTo;
}
