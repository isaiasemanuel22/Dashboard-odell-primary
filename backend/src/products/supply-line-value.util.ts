import { EstampadoSupplyLine } from '../common/interfaces';
import { normalizeEstampadoSupplies } from './estampado-product.util';

/**
 * Valor del insumo: cantidad × precio unitario, sin margen de área.
 * Se suma al costo; el precio lleva el valor × SUPPLY_PRICE_MULTIPLIER (§16.3).
 */
/** Los insumos de producto o línea a medida se cobran a costo × 1,5 (§16.3). */
export const SUPPLY_PRICE_MULTIPLIER = 1.5;

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

/** Precio de los insumos a partir de su valor (costo): round(valor × 1,5). */
export function supplyPriceFromValue(value: number): number {
  return Math.round((Number(value) || 0) * SUPPLY_PRICE_MULTIPLIER);
}

/** Precio de las líneas de insumo: round(supplyLinesValue × 1,5). */
export function supplyLinesPrice(
  lines: EstampadoSupplyLine[] | undefined,
  unitPriceOf: (supplyId: string) => number,
): number {
  return supplyPriceFromValue(supplyLinesValue(lines, unitPriceOf));
}
