import {
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
  GeneralSettings,
  OrderLineDraft,
  Product,
  ProductType,
  ServiceType,
} from '../../core/models';
import { ProductCostCalculationService } from '../../core/services/product-cost-calculation.service';
import {
  isEstampadoPrintValid,
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from './estampado.helpers';
import {
  getMarginForService,
  priceFromCostAndMargin,
} from './pricing.util';

export function isEstampadoLine(serviceType: ServiceType): boolean {
  return serviceType === ServiceType.ESTAMPADO;
}

export function isEstampadoQuoteConfigured(
  line: Pick<
    OrderLineDraft,
    'estampadoPrints' | 'estampadoPressCycles' | 'estampadoSupplies'
  >,
): boolean {
  const prints = normalizeEstampadoPrints(line.estampadoPrints);
  const supplies = normalizeEstampadoSupplies(line.estampadoSupplies);
  const cycles = normalizeEstampadoPressCycles(line.estampadoPressCycles);

  const hasPrints = prints.some(
    (print) => !!print.paperType && isEstampadoPrintValid(print),
  );
  const hasSupplies = supplies.some(
    (entry) => entry.supplyId && Number(entry.quantity) > 0,
  );
  const hasPress = cycles.some(
    (cycle) => Number(cycle.pressMinutes) > 0 && Number(cycle.bajadas) >= 1,
  );

  return hasPrints || hasSupplies || hasPress;
}

export function shouldShowEstampadoQuoteFields(
  line: OrderLineDraft,
  product: Product | undefined,
): boolean {
  if (!isEstampadoLine(line.serviceType)) return false;
  if (!line.productId?.trim()) return true;
  if (!product) return true;
  return product.type === ProductType.ESTAMPADO;
}

/** Completa la línea con impresos, insumos y bajadas del producto de catálogo. */
export function applyProductSpecsToEstampadoLine(
  line: OrderLineDraft,
  product: Product | undefined,
): void {
  if (!product || product.type !== ProductType.ESTAMPADO) return;
  const estampado = product as Extract<Product, { type: ProductType.ESTAMPADO }>;
  if (!line.conceptManual) {
    line.customName = product.name;
  }
  line.estampadoPrints = structuredClone(estampado.prints ?? []);
  line.estampadoPressCycles = structuredClone(estampado.pressCycles ?? []);
  line.estampadoSupplies = structuredClone(estampado.supplies ?? []);
}

export function syncEstampadoQuotePricing(
  line: OrderLineDraft,
  settings: GeneralSettings,
  costCalculator: ProductCostCalculationService,
  marginPercent: number,
  options?: { preservePrice?: boolean },
): void {
  if (!isEstampadoLine(line.serviceType) || !isEstampadoQuoteConfigured(line)) {
    return;
  }

  const breakdown = costCalculator.calculateCost(
    {
      type: ProductType.ESTAMPADO,
      workTimeHours: 0,
      estampadoPrints: normalizeEstampadoPrints(
        line.estampadoPrints,
      ) as EstampadoPrintSpec[],
      estampadoPressCycles: normalizeEstampadoPressCycles(
        line.estampadoPressCycles,
      ) as EstampadoPressCycle[],
      estampadoSupplies: normalizeEstampadoSupplies(
        line.estampadoSupplies,
      ) as EstampadoSupplyLine[],
    },
    { settings },
  );

  line.unitCost = breakdown.totalCost;
  if (!options?.preservePrice) {
    line.unitPrice = priceFromCostAndMargin(breakdown.totalCost, marginPercent);
  }
}

export function estampadoMargin(
  margins: Parameters<typeof getMarginForService>[1],
): number {
  return getMarginForService(ServiceType.ESTAMPADO, margins);
}
