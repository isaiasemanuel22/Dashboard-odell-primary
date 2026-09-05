import {
  FilamentType,
  GeneralSettings,
  OrderLineDraft,
  Product,
  ProductType,
  ServiceType,
  isProduct3D,
} from '../../core/models';
import { ProductCostCalculationService } from '../../core/services/product-cost-calculation.service';
import {
  getMarginForService,
  priceFromCostAndMargin,
} from './pricing.util';

export function isFdmQuoteConfigured(
  line: Pick<OrderLineDraft, 'grams' | 'printTimeHours' | 'filamentType'>,
): boolean {
  if (!line.filamentType) return false;
  const grams = Number(line.grams) || 0;
  const printTimeHours = Number(line.printTimeHours) || 0;
  return grams > 0 || printTimeHours > 0;
}

export function isImpresion3DLine(serviceType: ServiceType): boolean {
  return serviceType === ServiceType.IMPRESION_3D;
}

export function shouldShowFdmQuoteFields(
  line: OrderLineDraft,
  product: Product | undefined,
): boolean {
  if (!isImpresion3DLine(line.serviceType)) return false;
  if (!line.productId) return true;
  if (!product) return true;
  return product.type === ProductType.FDM || product.type === ProductType.COMBO;
}

export function applyProductSpecsToFdmLine(
  line: OrderLineDraft,
  product: Product | undefined,
): void {
  if (!product || !isImpresion3DLine(line.serviceType)) return;

  if (product.type === ProductType.FDM || product.type === ProductType.RESINA) {
    if (!isProduct3D(product)) return;
    if (product.grams != null) line.grams = product.grams;
    if (product.printTimeHours != null) {
      line.printTimeHours = product.printTimeHours;
    }
    if (product.filamentType) line.filamentType = product.filamentType;
    if (product.filaments?.length === 1) {
      const filament = product.filaments[0]!;
      if (filament.grams != null) line.grams = filament.grams;
      if (filament.filamentType) line.filamentType = filament.filamentType;
    }
  }
}

export function syncFdmQuotePricing(
  line: OrderLineDraft,
  settings: GeneralSettings,
  costCalculator: ProductCostCalculationService,
  marginPercent: number,
  options?: { preservePrice?: boolean },
): void {
  if (!isImpresion3DLine(line.serviceType) || !isFdmQuoteConfigured(line)) {
    return;
  }

  const breakdown = costCalculator.calculateCost(
    {
      type: ProductType.FDM,
      grams: Number(line.grams) || 0,
      printTimeHours: Number(line.printTimeHours) || 0,
      workTimeHours: 0,
      filamentType: line.filamentType as FilamentType,
    },
    { settings },
  );

  line.unitCost = breakdown.totalCost;
  if (!options?.preservePrice) {
    line.unitPrice = priceFromCostAndMargin(breakdown.totalCost, marginPercent);
  }
}

export function impresion3DMargin(margins: Parameters<typeof getMarginForService>[1]): number {
  return getMarginForService(ServiceType.IMPRESION_3D, margins);
}
