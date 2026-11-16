import { EstampadoSupplyLine } from '../common/interfaces';
import { normalizeEstampadoSupplies } from './estampado-product.util';

/**
 * Valor del insumo: cantidad × precio unitario, sin margen de área.
 * Al costo y al precio se suma además el margen de error de Ajustes (§16.3).
 * Misma fórmula que frontend/src/app/shared/utils/supply-line-value.util.ts.
 */
/** Los insumos de producto o línea a medida se cobran a costo × 2 (§16.3). */
export const SUPPLY_PRICE_MULTIPLIER = 2;

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
