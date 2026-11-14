/**
 * Markup sobre el COSTO: (precio − costo) ÷ costo × 100.
 * Misma fórmula que `backend/src/products/product-margin.util.ts`.
 * `laborCost` (mano de obra, que no lleva margen) se descuenta de la base:
 * el margen objetivo se mide sobre el costo SIN mano de obra.
 * Null si el costo no es usable.
 */
export function markupPercentOnCost(
  price: number,
  cost: number,
  laborCost = 0,
): number | null {
  const labor = Math.min(
    Math.max(Number(laborCost) || 0, 0),
    Math.max(Number(cost) || 0, 0),
  );
  const safeCost = Number(cost) - labor;
  if (!Number.isFinite(safeCost) || safeCost <= 0) {
    return null;
  }
  const safePrice = Number(price);
  if (!Number.isFinite(safePrice)) {
    return null;
  }
  return ((safePrice - Number(cost)) / safeCost) * 100;
}

/** Porcentaje entero para mostrar en UI. */
export function markupPercentOnCostRounded(
  price: number,
  cost: number,
  laborCost = 0,
): number | null {
  const raw = markupPercentOnCost(price, cost, laborCost);
  return raw == null ? null : Math.round(raw);
}

export function hasFixedCatalogPrice(
  product: { suggestedPrice?: number | null } | null | undefined,
): boolean {
  return (
    product?.suggestedPrice != null && Number(product.suggestedPrice) > 0
  );
}
