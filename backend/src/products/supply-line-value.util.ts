import { EstampadoSupplyLine } from '../common/interfaces';
import { normalizeEstampadoSupplies } from './estampado-product.util';

/**
 * Valor del insumo: cantidad × precio unitario, sin margen de área.
 * El mismo importe se suma al costo y al precio (§3, §16.3).
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
