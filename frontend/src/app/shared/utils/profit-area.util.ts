import {
  Product,
  ProductType,
  ProfitArea,
  SaleEntry,
  SaleEntryItem,
  ServiceType,
} from '../../core/models';

const PROFIT_AREAS: ProfitArea[] = [
  ServiceType.IMPRESION_3D,
  ServiceType.DISENO_GRAFICO,
  ServiceType.MODELADO,
  ServiceType.ESTAMPADO,
];

export function listProfitAreas(): ProfitArea[] {
  return [...PROFIT_AREAS];
}

export function resolveProfitArea(
  product: Pick<Product, 'type'> | null | undefined,
  serviceType?: ServiceType,
): ProfitArea | null {
  if (product) {
    if (product.type === ProductType.ESTAMPADO) {
      return ServiceType.ESTAMPADO;
    }
    return ServiceType.IMPRESION_3D;
  }

  if (!serviceType) {
    return null;
  }

  if (serviceType === ServiceType.ESTAMPADO) {
    return ServiceType.ESTAMPADO;
  }
  if (serviceType === ServiceType.IMPRESION_3D) {
    return ServiceType.IMPRESION_3D;
  }
  if (serviceType === ServiceType.DISENO_GRAFICO) {
    return ServiceType.DISENO_GRAFICO;
  }
  if (serviceType === ServiceType.MODELADO) {
    return ServiceType.MODELADO;
  }

  return null;
}

export function allocateSaleEntryItemEconomics(
  entry: SaleEntry,
  item: SaleEntryItem,
): { total: number; cost: number; profit: number } {
  const subtotal = entry.items.reduce((sum, line) => sum + line.lineTotal, 0);
  const share = subtotal > 0 ? item.lineTotal / subtotal : 0;

  return {
    total: entry.total * share,
    cost: entry.cost * share,
    profit: entry.profit * share,
  };
}
