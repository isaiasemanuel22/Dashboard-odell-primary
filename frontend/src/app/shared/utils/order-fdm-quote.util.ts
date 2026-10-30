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
import { normalizeFdmFilaments, totalFdmFilamentGrams } from './fdm.helpers';
import {
  getMarginForService,
  priceFromCostAndMargin,
} from './pricing.util';

export function isFdmQuoteConfigured(
  line: Pick<
    OrderLineDraft,
    'grams' | 'printTimeHours' | 'filamentType' | 'filaments'
  >,
): boolean {
  const printTimeHours = Number(line.printTimeHours) || 0;
  if (line.filaments?.length) {
    const grams = totalFdmFilamentGrams(line.filaments);
    const hasType = line.filaments.some((row) => !!row.filamentType);
    return hasType && (grams > 0 || printTimeHours > 0);
  }
  if (!line.filamentType) return false;
  const grams = Number(line.grams) || 0;
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
  if (!line.productId?.trim()) return true;
  if (!product) return true;
  return product.type === ProductType.FDM || product.type === ProductType.COMBO;
}

/** Completa campos vacíos / specs de la línea con los del producto de catálogo. */
export function applyProductSpecsToFdmLine(
  line: OrderLineDraft,
  product: Product | undefined,
): void {
  if (!product || !isImpresion3DLine(line.serviceType)) return;

  if (product.type === ProductType.FDM || product.type === ProductType.RESINA) {
    if (!isProduct3D(product)) return;
    if (!line.conceptManual) {
      line.customName = product.name;
    }
    if (product.printTimeHours != null) {
      line.printTimeHours = product.printTimeHours;
    }
    if (product.workTimeHours != null) {
      line.workTimeHours = product.workTimeHours;
    }
    if (product.filaments?.length) {
      line.filaments = normalizeFdmFilaments(
        product.filaments.map((row) => ({
          ...row,
          brand: row.brand?.trim() || product.brand,
        })),
        {
          grams: product.grams,
          filamentType: product.filamentType,
          brand: product.brand,
        },
      );
      line.grams = totalFdmFilamentGrams(line.filaments);
      line.filamentType =
        line.filaments.find((row) => row.filamentType)?.filamentType ??
        product.filamentType;
    } else {
      if (product.grams != null) line.grams = product.grams;
      if (product.filamentType) line.filamentType = product.filamentType;
      line.filaments = normalizeFdmFilaments(undefined, {
        grams: product.grams,
        filamentType: product.filamentType,
        brand: product.brand,
        colorId: product.colorId,
      });
      if (!line.filaments.length) {
        line.filaments = undefined;
      }
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
      workTimeHours: Number(line.workTimeHours) || 0,
      filamentType: line.filamentType as FilamentType,
      filaments: line.filaments,
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
