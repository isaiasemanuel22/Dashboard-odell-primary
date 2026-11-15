import { EstampadoSupplyLine, SupplyCategory } from '../../core/models';
import { normalizeEstampadoSupplies } from './estampado.helpers';

/**
 * Valor del insumo: cantidad × precio unitario, sin margen de área.
 * Se suma al costo; el precio lleva el valor × SUPPLY_PRICE_MULTIPLIER (§16.3).
 * Misma fórmula que backend/src/products/supply-line-value.util.ts.
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

/** Insumo de catálogo. Filamento, resina y alcohol de lavado no entran (§5.1, §9.1). */
export function isCatalogInsumo(supply: { category: SupplyCategory }): boolean {
  return (
    supply.category === SupplyCategory.ESTAMPADO ||
    supply.category === SupplyCategory.GENERAL
  );
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
