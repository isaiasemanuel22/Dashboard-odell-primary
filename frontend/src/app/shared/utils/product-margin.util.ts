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

/**
 * Margen del proceso (§16.1.1, «Márgenes que se muestran»):
 * (precio del proceso − costo del proceso) ÷ costo del proceso × 100.
 * Precio del proceso = precio de venta − `nonProcessPrice` (mano de obra +
 * precio de insumos + precio de packaging). Costo 0 → null.
 * Misma fórmula que `backend/src/products/product-margin.util.ts`.
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

export function processMarginPercentRounded(
  salePrice: number,
  processCost: number,
  nonProcessPrice: number,
): number | null {
  const raw = processMarginPercent(salePrice, processCost, nonProcessPrice);
  return raw == null ? null : Math.round(raw);
}

/**
 * Margen total: (precio de venta − costo total) ÷ costo total × 100.
 * El costo total incluye todo (también mano de obra, insumos y packaging).
 */
export function totalMarginPercent(
  salePrice: number,
  totalCost: number,
): number | null {
  const cost = Number(totalCost);
  const price = Number(salePrice);
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(price)) {
    return null;
  }
  return ((price - cost) / cost) * 100;
}

export function totalMarginPercentRounded(
  salePrice: number,
  totalCost: number,
): number | null {
  const raw = totalMarginPercent(salePrice, totalCost);
  return raw == null ? null : Math.round(raw);
}

/**
 * Margen del proceso de un producto del catálogo (el backend manda
 * `processCost` y `nonProcessPrice`). Sin esos datos (producto recién
 * guardado, aún sin recargar) cae al margen sin mano de obra de siempre.
 */
export function productProcessMarginRounded(
  product: {
    cost: number;
    processCost?: number;
    nonProcessPrice?: number;
  },
  salePrice: number,
  laborCost = 0,
): number | null {
  if (product.processCost == null) {
    return markupPercentOnCostRounded(salePrice, product.cost, laborCost);
  }
  return processMarginPercentRounded(
    salePrice,
    product.processCost,
    product.nonProcessPrice ?? 0,
  );
}
