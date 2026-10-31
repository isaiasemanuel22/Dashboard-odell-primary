import {
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
  GeneralSettings,
  ImpresoWithCost,
  OrderLineDraft,
  Product,
  ProductType,
  ServiceType,
  Supply,
} from '../../core/models';
import { ProductCostCalculationService } from '../../core/services/product-cost-calculation.service';
import {
  isEstampadoPrintValid,
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
  syncEstampadoPrintFromImpreso,
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

  // Impreso por id (sin medidas aún) también cuenta: el costeo resuelve dims.
  const hasPrints = prints.some(
    (print) =>
      (!!print.paperType && isEstampadoPrintValid(print)) ||
      !!print.impresoId?.trim(),
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

/**
 * Normaliza el desglose guardado; si falta (línea de catálogo), lo toma del producto.
 * Enriquece impresos desde el catálogo de impresos cuando solo hay `impresoId`.
 */
export function hydrateEstampadoQuoteSpecs(
  line: OrderLineDraft,
  product: Product | undefined,
  impresos: ImpresoWithCost[] = [],
): void {
  if (!isEstampadoLine(line.serviceType)) return;

  let prints = normalizeEstampadoPrints(line.estampadoPrints);
  if (impresos.length && prints.length) {
    prints = prints.map((print) =>
      syncEstampadoPrintFromImpreso(print, impresos),
    );
  }
  line.estampadoPrints = prints;
  line.estampadoPressCycles = normalizeEstampadoPressCycles(
    line.estampadoPressCycles,
  );
  line.estampadoSupplies = normalizeEstampadoSupplies(line.estampadoSupplies);

  if (!isEstampadoQuoteConfigured(line) && line.productId?.trim()) {
    applyProductSpecsToEstampadoLine(line, product);
  }
}

export function syncEstampadoQuotePricing(
  line: OrderLineDraft,
  settings: GeneralSettings,
  costCalculator: ProductCostCalculationService,
  marginPercent: number,
  options?: {
    preservePrice?: boolean;
    /** No pisar unitCost snapshot (reabrir presupuesto/pedido). */
    preserveCost?: boolean;
    supplies?: Supply[];
    impresos?: ImpresoWithCost[];
  },
): void {
  if (!isEstampadoLine(line.serviceType) || !isEstampadoQuoteConfigured(line)) {
    return;
  }

  const breakdown = costCalculator.calculateCost(
    {
      type: ProductType.ESTAMPADO,
      workTimeHours: Number(line.workTimeHours) || 0,
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
    {
      settings,
      supplies: options?.supplies,
      impresos: options?.impresos,
    },
  );

  const keepCost =
    options?.preserveCost &&
    line.unitCost != null &&
    Number.isFinite(Number(line.unitCost));
  if (!keepCost) {
    line.unitCost = breakdown.totalCost;
  }
  const preserve = options?.preservePrice || !!line.unitPriceManual;
  if (!preserve) {
    const costForPrice = keepCost
      ? Number(line.unitCost)
      : breakdown.totalCost;
    line.unitPrice = priceFromCostAndMargin(costForPrice, marginPercent);
  }
}

export function estampadoMargin(
  margins: Parameters<typeof getMarginForService>[1],
): number {
  return getMarginForService(ServiceType.ESTAMPADO, margins);
}
