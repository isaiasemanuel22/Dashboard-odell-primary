import {
  FilamentType,
  GeneralSettings,
  OrderLineDraft,
  Product,
  ProductType,
  ResinType,
  ServiceType,
  isProduct3D,
} from '../../core/models';
import { ProductCostCalculationService } from '../../core/services/product-cost-calculation.service';
import { normalizeFdmFilaments, totalFdmFilamentGrams } from './fdm.helpers';
import {
  getMarginForService,
  priceFromCostAndMargin,
} from './pricing.util';
import {
  productUsesPieceAssembly,
  resolveProductGrams,
  resolveProductPrintTimeHours,
} from './product.helpers';

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

/** Resina manual (o con tipo en la línea) lista para costear. */
export function isResinQuoteConfigured(
  line: Pick<
    OrderLineDraft,
    'grams' | 'printTimeHours' | 'resinType' | 'printProcess'
  >,
): boolean {
  if (line.printProcess === 'fdm') return false;
  if (line.printProcess !== 'resina' && !line.resinType) return false;
  if (!line.resinType) return false;
  const grams = Number(line.grams) || 0;
  const printTimeHours = Number(line.printTimeHours) || 0;
  return grams > 0 || printTimeHours > 0;
}

export function isImpresion3DLine(serviceType: ServiceType): boolean {
  return serviceType === ServiceType.IMPRESION_3D;
}

/** Catálogo RESINA o presupuesto manual en modo resina. */
export function isResinQuoteLine(
  line: OrderLineDraft,
  product: Product | undefined,
): boolean {
  if (product?.type === ProductType.RESINA) return true;
  if (line.productId?.trim()) return false;
  return line.printProcess === 'resina' || !!line.resinType;
}

export function shouldShowFdmQuoteFields(
  line: OrderLineDraft,
  product: Product | undefined,
): boolean {
  if (!isImpresion3DLine(line.serviceType)) return false;
  if (!line.productId?.trim()) return true;
  if (!product) return true;
  return (
    product.type === ProductType.FDM ||
    product.type === ProductType.COMBO ||
    product.type === ProductType.RESINA
  );
}

/**
 * N6: mano de obra al cotizar un producto de catálogo.
 * Con piezas: solo el armado (la MO de cada parte ya está en su costo/precio).
 * Sin piezas: trabajo + armado.
 */
export function resolveQuoteLaborHoursFromProduct(
  product: Product,
  _catalog: Product[] = [],
): number {
  if (productUsesPieceAssembly(product)) {
    return Math.max(0, Number(product.assemblyTimeHours) || 0);
  }
  const work =
    'workTimeHours' in product ? Number(product.workTimeHours) || 0 : 0;
  const assembly = Number(product.assemblyTimeHours) || 0;
  return Math.max(0, work) + Math.max(0, assembly);
}

/** Completa campos vacíos / specs de la línea con los del producto de catálogo. */
export function applyProductSpecsToFdmLine(
  line: OrderLineDraft,
  product: Product | undefined,
  catalog: Product[] = [],
): void {
  if (!product || !isImpresion3DLine(line.serviceType)) return;

  if (product.type === ProductType.FDM || product.type === ProductType.RESINA) {
    if (!isProduct3D(product)) return;
    if (!line.conceptManual) {
      line.customName = product.name;
    }
    if (productUsesPieceAssembly(product)) {
      line.printTimeHours = resolveProductPrintTimeHours(product, catalog);
      line.grams = resolveProductGrams(product, catalog);
    } else {
      if (product.printTimeHours != null) {
        line.printTimeHours = product.printTimeHours;
      }
      if (product.grams != null) line.grams = product.grams;
    }
    line.workTimeHours = resolveQuoteLaborHoursFromProduct(product, catalog);

    if (product.type === ProductType.RESINA) {
      // Resina no usa filamentos; alcanza grams + tiempos del producto.
      line.filaments = undefined;
      return;
    }

    if (product.filaments?.length) {
      // N1: en presupuesto no se cotiza por marca; solo tipo + promedio.
      line.filaments = normalizeFdmFilaments(
        product.filaments.map((row) => ({
          ...row,
          brand: undefined,
        })),
        {
          grams: product.grams,
          filamentType: product.filamentType,
        },
      );
      line.grams = totalFdmFilamentGrams(line.filaments);
      line.filamentType =
        line.filaments.find((row) => row.filamentType)?.filamentType ??
        product.filamentType;
    } else {
      if (product.filamentType) line.filamentType = product.filamentType;
      line.filaments = normalizeFdmFilaments(undefined, {
        grams: line.grams ?? product.grams,
        filamentType: product.filamentType,
        colorId: product.colorId,
      });
      if (!line.filaments.length) {
        line.filaments = undefined;
      }
    }
  } else if (product.type === ProductType.COMBO) {
    if (!line.conceptManual) {
      line.customName = product.name;
    }
    line.grams = resolveProductGrams(product, catalog);
    line.printTimeHours = resolveProductPrintTimeHours(product, catalog);
    line.workTimeHours = resolveQuoteLaborHoursFromProduct(product, catalog);
  }
}

export function syncFdmQuotePricing(
  line: OrderLineDraft,
  settings: GeneralSettings,
  costCalculator: ProductCostCalculationService,
  marginPercent: number,
  options?: {
    preservePrice?: boolean;
    /** No pisar unitCost snapshot (reabrir presupuesto/pedido). */
    preserveCost?: boolean;
    productType?: ProductType;
    brand?: string;
    resinType?: ResinType;
    washMinutes?: number;
    cureMinutes?: number;
  },
): void {
  if (!isImpresion3DLine(line.serviceType)) return;

  const isResin =
    options?.productType === ProductType.RESINA ||
    (!options?.productType &&
      (line.printProcess === 'resina' || !!options?.resinType || !!line.resinType));
  const resinType = options?.resinType ?? line.resinType;
  const resinReady =
    isResin &&
    !!resinType &&
    ((Number(line.grams) || 0) > 0 || (Number(line.printTimeHours) || 0) > 0);
  if (!isResin && !isFdmQuoteConfigured(line)) {
    return;
  }
  if (isResin && !resinReady) {
    return;
  }

  const type = isResin ? ProductType.RESINA : ProductType.FDM;

  // N1: FDM cotiza por promedio del tipo; no pasar marca de producto/filamento.
  const filamentsForQuote = isResin
    ? undefined
    : (line.filaments ?? []).map((row) => ({ ...row, brand: undefined }));

  const breakdown = costCalculator.calculateCost(
    {
      type,
      grams: Number(line.grams) || 0,
      printTimeHours: Number(line.printTimeHours) || 0,
      workTimeHours: Number(line.workTimeHours) || 0,
      filamentType: isResin
        ? undefined
        : (line.filamentType as FilamentType),
      filaments: filamentsForQuote?.length ? filamentsForQuote : undefined,
      brand: isResin ? options?.brand : undefined,
      resinType: isResin ? resinType : undefined,
      washMinutes: options?.washMinutes,
      cureMinutes: options?.cureMinutes,
    },
    { settings },
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

export function impresion3DMargin(margins: Parameters<typeof getMarginForService>[1]): number {
  return getMarginForService(ServiceType.IMPRESION_3D, margins);
}
