/**
 * Markup sobre el COSTO: (precio − costo) ÷ costo × 100.
 * Misma fórmula que `backend/src/products/product-margin.util.ts`.
 * Null si el costo no es usable.
 */
export function markupPercentOnCost(
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

/** Porcentaje entero para mostrar en UI. */
export function markupPercentOnCostRounded(
  price: number,
  cost: number,
): number | null {
  const raw = markupPercentOnCost(price, cost);
  return raw == null ? null : Math.round(raw);
}

export function hasFixedCatalogPrice(
  product: { suggestedPrice?: number | null } | null | undefined,
): boolean {
  return (
    product?.suggestedPrice != null && Number(product.suggestedPrice) > 0
  );
}
