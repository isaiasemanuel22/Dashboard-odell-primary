import { EstampadoSupplyLine, SupplyCategory } from '../../core/models';
import { normalizeEstampadoSupplies } from './estampado.helpers';

/**
 * Valor del insumo: cantidad × precio unitario, sin margen de área.
 * Al costo y al precio se suma además el margen de error de Ajustes (§16.3).
 * Misma fórmula que backend/src/products/supply-line-value.util.ts.
 */
/** Los insumos de producto o línea a medida se cobran a costo × 2 (§16.3). */
export const SUPPLY_PRICE_MULTIPLIER = 2;

/** El packaging se cobra a costo × 1,25, sin margen de error (§27.2). */
export const PACKAGING_PRICE_MULTIPLIER = 1.25;

/** Precio del packaging: round(valor × 1,25). Costo = valor (§27.2). */
export function packagingPriceFromValue(value: number): number {
  return Math.round((Number(value) || 0) * PACKAGING_PRICE_MULTIPLIER);
}

/**
 * Costo vigente del producto para una línea de catálogo, o `null` si no
 * cambió. Ignora el packaging: la línea puede traer el suyo editado (§27.3),
 * así que se compara sin packaging de ambos lados y el costo propuesto
 * conserva el packaging de la línea.
 */
export function catalogCostChangeIgnoringPackaging(
  lineCost: number,
  linePackagingValue: number,
  catalogCost: number,
  catalogPackagingValue: number,
): number | null {
  const catalog = Math.round(Number(catalogCost) || 0);
  if (catalog <= 0) return null;
  const lineBase =
    Math.round(Number(lineCost) || 0) -
    Math.round(Number(linePackagingValue) || 0);
  const catalogBase = catalog - Math.round(Number(catalogPackagingValue) || 0);
  if (lineBase === catalogBase) return null;
  return catalogBase + Math.round(Number(linePackagingValue) || 0);
}

/** Mismo clamp 0–100 que calculateErrorMarginCost. */
export function clampErrorMarginPercent(percent: number): number {
  return Math.min(Math.max(Number(percent) || 0, 0), 100);
}

/** Valor del insumo: cantidad × precio unitario (sin error ni × 2). */
export function supplyLinesValue(
  lines: EstampadoSupplyLine[] | undefined,
  unitPriceOf: (supplyId: string) => number,
): number {
  const total = normalizeEstampadoSupplies(lines).reduce((sum, line) => {
    const unit = Number(unitPriceOf(line.supplyId)) || 0;
    if (unit <= 0) return sum;
    return sum + unit * line.quantity;
  }, 0);
  return Math.round(total);
}

/**
 * Error del insumo sobre su valor: round(valor × margen/100).
 * Se suma tal cual a costo y precio (sin el recargo).
 */
export function supplyErrorFromValue(
  value: number,
  errorMarginPercent = 0,
): number {
  const percent = clampErrorMarginPercent(errorMarginPercent);
  if (percent === 0) return 0;
  return Math.round((Number(value) || 0) * (percent / 100));
}

/** Costo del insumo: valor + error del insumo (§16.3). */
export function supplyCostFromValue(
  value: number,
  errorMarginPercent = 0,
): number {
  const raw = Number(value) || 0;
  return Math.round(raw) + supplyErrorFromValue(raw, errorMarginPercent);
}

/** Precio de los insumos: round(valor × 2) + error (el error no lleva el recargo). */
export function supplyPriceFromValue(
  value: number,
  errorMarginPercent = 0,
): number {
  const raw = Number(value) || 0;
  return (
    Math.round(raw * SUPPLY_PRICE_MULTIPLIER) +
    supplyErrorFromValue(raw, errorMarginPercent)
  );
}

/** Costo de las líneas: valor + error del insumo. */
export function supplyLinesCost(
  lines: EstampadoSupplyLine[] | undefined,
  unitPriceOf: (supplyId: string) => number,
  errorMarginPercent = 0,
): number {
  return supplyCostFromValue(
    supplyLinesValue(lines, unitPriceOf),
    errorMarginPercent,
  );
}

/** Precio de las líneas: valor × 2 + error del insumo. */
export function supplyLinesPrice(
  lines: EstampadoSupplyLine[] | undefined,
  unitPriceOf: (supplyId: string) => number,
  errorMarginPercent = 0,
): number {
  return supplyPriceFromValue(
    supplyLinesValue(lines, unitPriceOf),
    errorMarginPercent,
  );
}

/** Insumo de categoría Packaging (§27). */
export function isPackagingSupply(supply: { category: SupplyCategory }): boolean {
  return supply.category === SupplyCategory.PACKAGING;
}

/** Insumo de catálogo. Filamento, resina y alcohol de lavado no entran (§5.1, §9.1). */
export function isCatalogInsumo(supply: { category: SupplyCategory }): boolean {
  return (
    supply.category === SupplyCategory.ESTAMPADO ||
    supply.category === SupplyCategory.GENERAL
  );
}

/** Qué lista de insumos se edita: los insumos comunes o el packaging (§27.1). */
export type SupplyLineMode = 'supplies' | 'packaging';

/**
 * Insumos que ofrece el selector según el modo: en «Packaging» solo los de
 * categoría Packaging; en «Insumos» los de catálogo, sin Packaging (§27.1).
 */
export function suppliesForMode<T extends { category: SupplyCategory }>(
  supplies: T[],
  mode: SupplyLineMode = 'supplies',
): T[] {
  return supplies.filter(
    mode === 'packaging' ? isPackagingSupply : isCatalogInsumo,
  );
}
