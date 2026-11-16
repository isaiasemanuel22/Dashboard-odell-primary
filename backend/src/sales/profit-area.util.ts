import { ProductType, SaleSource, ServiceType } from '../common/enums';
import {
  AreaProfitBalance,
  AreaProfitSourceBreakdown,
  Product,
  SaleEntry,
  SaleEntryItem,
  UNASSIGNED_PROFIT_AREA,
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
    ? (normalizeServiceType(serviceType) ?? serviceType)
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

function addToBucket(
  bucket: AreaProfitBalance,
  source: SaleSource,
  revenue: number,
  cost: number,
): void {
  const sourceBucket =
    source === SaleSource.RETAIL ? bucket.retail : bucket.orders;
  bucket.revenue += revenue;
  bucket.cost += cost;
  bucket.profit += revenue - cost;
  sourceBucket.revenue += revenue;
  sourceBucket.cost += cost;
  sourceBucket.profit += revenue - cost;
}

export function computeAreaProfitBalances(
  entries: SaleEntry[],
  resolveUnitCost: (item: SaleEntryItem) => number,
  resolveProduct: (productId: string) => Pick<Product, 'type'> | null,
): AreaProfitBalance[] {
  const totals = new Map<AreaProfitBalance['area'], AreaProfitBalance>(
    emptyAreaProfitBalances().map((balance) => [balance.area, { ...balance }]),
  );

  // Lo que no cae en ninguna área (ítems sin producto ni servicio, pedidos
  // con subtotal 0): sin esto la suma de áreas no llega al total del mes.
  const unassigned: AreaProfitBalance = {
    area: UNASSIGNED_PROFIT_AREA,
    revenue: 0,
    cost: 0,
    profit: 0,
    retail: emptyAreaProfitSourceBreakdown(),
    orders: emptyAreaProfitSourceBreakdown(),
  };

  for (const entry of entries) {
    const subtotal = entry.items.reduce((sum, item) => sum + item.lineTotal, 0);
    let assignedRevenue = 0;

    for (const item of entry.items) {
      const product = item.productId ? resolveProduct(item.productId) : null;
      const area = resolveProfitArea(product, item.serviceType);

      const normalizedService = item.serviceType
        ? (normalizeServiceType(item.serviceType) ?? item.serviceType)
        : undefined;
      const quantityMultiplier =
        normalizedService && isDesignService(normalizedService)
          ? 1
          : item.quantity;
      const lineCost = resolveUnitCost(item) * quantityMultiplier;
      const lineRevenue =
        subtotal > 0 ? (item.lineTotal / subtotal) * entry.total : 0;
      if (!area) {
        // Su ingreso entra por el resto del pedido (abajo); acá solo el costo.
        addToBucket(unassigned, entry.source, 0, lineCost);
        continue;
      }
      assignedRevenue += lineRevenue;
      addToBucket(totals.get(area)!, entry.source, lineRevenue, lineCost);
    }

    const remainder = entry.total - assignedRevenue;
    if (Math.abs(remainder) > 0.005) {
      addToBucket(unassigned, entry.source, remainder, 0);
    }
  }

  const balances = PROFIT_AREAS.map((area) => totals.get(area)!);
  const hasUnassigned =
    Math.abs(unassigned.revenue) > 0.005 || Math.abs(unassigned.cost) > 0.005;
  return hasUnassigned ? [...balances, unassigned] : balances;
}
