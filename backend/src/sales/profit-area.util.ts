import { ProductType, SaleSource, ServiceType } from '../common/enums';
import {
  AreaProfitBalance,
  AreaProfitSourceBreakdown,
  Product,
  SaleEntry,
  SaleEntryItem,
} from '../common/interfaces';
import {
  isDesignService,
  LEGACY_DESIGN_SERVICE,
  normalizeServiceType,
} from '../common/service-type.util';

export type ProfitArea =
  | ServiceType.IMPRESION_3D
  | ServiceType.DISENO_GRAFICO
  | ServiceType.MODELADO
  | ServiceType.ESTAMPADO;

const PROFIT_AREAS: ProfitArea[] = [
  ServiceType.IMPRESION_3D,
  ServiceType.DISENO_GRAFICO,
  ServiceType.MODELADO,
  ServiceType.ESTAMPADO,
];

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

  const normalized = serviceType
    ? normalizeServiceType(serviceType) ?? serviceType
    : undefined;

  if (normalized === ServiceType.ESTAMPADO) {
    return ServiceType.ESTAMPADO;
  }
  if (normalized === ServiceType.IMPRESION_3D) {
    return ServiceType.IMPRESION_3D;
  }
  if (normalized === ServiceType.DISENO_GRAFICO) {
    return ServiceType.DISENO_GRAFICO;
  }
  if (normalized === ServiceType.MODELADO) {
    return ServiceType.MODELADO;
  }
  if (serviceType === (LEGACY_DESIGN_SERVICE as ServiceType)) {
    return ServiceType.DISENO_GRAFICO;
  }

  return null;
}

export function emptyAreaProfitSourceBreakdown(): AreaProfitSourceBreakdown {
  return {
    revenue: 0,
    cost: 0,
    profit: 0,
  };
}

export function emptyAreaProfitBalances(): AreaProfitBalance[] {
  return PROFIT_AREAS.map((area) => ({
    area,
    revenue: 0,
    cost: 0,
    profit: 0,
    retail: emptyAreaProfitSourceBreakdown(),
    orders: emptyAreaProfitSourceBreakdown(),
  }));
}

export function computeAreaProfitBalances(
  entries: SaleEntry[],
  resolveUnitCost: (item: SaleEntryItem) => number,
  resolveProduct: (productId: string) => Pick<Product, 'type'> | null,
): AreaProfitBalance[] {
  const totals = new Map<ProfitArea, AreaProfitBalance>(
    emptyAreaProfitBalances().map((balance) => [balance.area, { ...balance }]),
  );

  for (const entry of entries) {
    const subtotal = entry.items.reduce((sum, item) => sum + item.lineTotal, 0);

    for (const item of entry.items) {
      const product = item.productId ? resolveProduct(item.productId) : null;
      const area = resolveProfitArea(product, item.serviceType);
      if (!area) continue;

      const normalizedService = item.serviceType
        ? normalizeServiceType(item.serviceType) ?? item.serviceType
        : undefined;
      const quantityMultiplier =
        normalizedService && isDesignService(normalizedService)
          ? 1
          : item.quantity;
      const lineCost = resolveUnitCost(item) * quantityMultiplier;
      const lineRevenue =
        subtotal > 0 ? (item.lineTotal / subtotal) * entry.total : 0;
      const lineProfit = lineRevenue - lineCost;
      const bucket = totals.get(area)!;
      const sourceBucket =
        entry.source === SaleSource.RETAIL ? bucket.retail : bucket.orders;

      bucket.revenue += lineRevenue;
      bucket.cost += lineCost;
      bucket.profit += lineProfit;
      sourceBucket.revenue += lineRevenue;
      sourceBucket.cost += lineCost;
      sourceBucket.profit += lineProfit;
    }
  }

  return PROFIT_AREAS.map((area) => totals.get(area)!);
}
