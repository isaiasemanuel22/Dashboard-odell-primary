import { EstampadoSupplyLine, SupplyCategory } from '../../core/models';
import { normalizeEstampadoSupplies } from './estampado.helpers';

/**
 * Valor del insumo: cantidad × precio unitario, sin margen de área.
 * El mismo importe se suma al costo y al precio (§3, §16.3).
 * Misma fórmula que backend/src/products/supply-line-value.util.ts.
 */
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
