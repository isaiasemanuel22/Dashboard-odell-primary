import {
  isProduct3D,
  Product,
  ProductEstampado,
  ProductType,
} from '../../core/models';
import {
  normalizeProductComponents,
  resolveProductWorkTimeHours,
} from './product.helpers';

/**
 * Mano de obra del producto (armado si es compuesto): no lleva margen.
 * Misma regla en detalle y listado para que el margen coincida.
 */
export function resolveProductLaborCost(
  product: Product | null | undefined,
  catalog: Product[],
  laborCostPerHour: number | null | undefined,
): number {
  if (!product) return 0;
  const rate = Number(laborCostPerHour) || 0;
  if (rate <= 0) return 0;
  let hours = 0;
  if (normalizeProductComponents(product.components ?? [], catalog).length > 0) {
    hours = Number(product.assemblyTimeHours) || 0;
  } else if (isProduct3D(product)) {
    hours = resolveProductWorkTimeHours(product, catalog);
  } else if (product.type === ProductType.ESTAMPADO) {
    hours = Number((product as ProductEstampado).workTimeHours) || 0;
  }
  return Math.round(hours * rate);
}
