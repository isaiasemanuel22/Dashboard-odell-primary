export type PriceRoundTo = 0 | 100 | 500;

/**
 * Markup sobre el costo: (precio − costo) ÷ costo × 100. Null si la base <= 0.
 * `laborCost` se descuenta de la base: el margen se mide sin mano de obra.
 */
export function productMarkupPercent(
  price: number,
  cost: number,
  laborCost = 0,
): number | null {
  const totalCost = Number(cost);
  const labor = Math.min(
    Math.max(Number(laborCost) || 0, 0),
    Math.max(totalCost || 0, 0),
  );
  const safeCost = totalCost - labor;
  if (!Number.isFinite(safeCost) || safeCost <= 0) {
    return null;
  }
  const safePrice = Number(price);
  if (!Number.isFinite(safePrice)) {
    return null;
  }
  return ((safePrice - totalCost) / safeCost) * 100;
}

/**
 * Margen del proceso: (precio del proceso − costo del proceso) ÷ costo del
 * proceso × 100. El precio del proceso es el de venta menos lo que no es
 * proceso (mano de obra, insumos y packaging). Null si el costo es <= 0.
 * Misma fórmula que frontend/src/app/shared/utils/product-margin.util.ts.
 */
export function processMarginPercent(
  salePrice: number,
  processCost: number,
  nonProcessPrice: number,
): number | null {
  const cost = Number(processCost);
  const price = Number(salePrice) - (Number(nonProcessPrice) || 0);
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(price)) {
    return null;
  }
  return ((price - cost) / cost) * 100;
}

/**
 * Precio de lista para alcanzar el markup objetivo sobre el costo sin mano de
 * obra (+ mano de obra sin margen), redondeado hacia arriba
 * al múltiplo `roundTo` (por defecto 100).
 */
export function priceForTargetMarkup(
  cost: number,
  targetPercent: number,
  roundTo = 100,
  laborCost = 0,
): number {
  const safeCost = Number(cost) || 0;
  const target = Number(targetPercent) || 0;
  // La mano de obra no lleva margen: se suma al precio tal cual.
  const labor = Math.min(Math.max(Number(laborCost) || 0, 0), safeCost);
  const raw = (safeCost - labor) * (1 + target / 100) + labor;
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
