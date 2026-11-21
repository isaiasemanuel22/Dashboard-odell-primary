import { EstampadoSupplyLine, OrderItem, Product } from '../common/interfaces';
import { normalizeEstampadoSupplies } from '../products/estampado-product.util';

export interface PackagingConsumption {
  supplyId: string;
  amount: number;
}

/**
 * Packaging a descontar al entregar `deliveredQty` unidades de la línea (§27.5).
 * - Propio de la línea: cantidad de cada renglón × unidades entregadas.
 * - Combo con «Sumar el packaging de las piezas»: el packaging propio de cada
 *   pieza × cantidad de la pieza × unidades (una sola vuelta, sin recursión).
 */
export function packagingConsumptionOnDelivery(
  item: Pick<OrderItem, 'packagingSupplies' | 'productId'>,
  deliveredQty: number,
  findProduct: (productId: string) => Product | undefined,
): PackagingConsumption[] {
  if (!(deliveredQty > 0)) return [];
  const totals = new Map<string, number>();
  const add = (lines: EstampadoSupplyLine[], factor: number) => {
    for (const line of lines) {
      const amount = Number(line.quantity) * factor;
      if (!line.supplyId?.trim() || !(amount > 0)) continue;
      totals.set(line.supplyId, (totals.get(line.supplyId) ?? 0) + amount);
    }
  };

  add(normalizeEstampadoSupplies(item.packagingSupplies), deliveredQty);

  const product = item.productId ? findProduct(item.productId) : undefined;
  if (product?.sumPiecesPackaging === true) {
    for (const component of product.components ?? []) {
      const piece = findProduct(component.productId);
      if (!piece) continue;
      add(
        normalizeEstampadoSupplies(piece.packagingSupplies),
        Number(component.quantity) * deliveredQty,
      );
    }
  }

  return [...totals].map(([supplyId, amount]) => ({ supplyId, amount }));
}
