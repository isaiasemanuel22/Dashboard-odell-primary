import {
  ProductType,
  ServiceProfitMargins,
  ServiceType,
} from '../../core/models';
import { LEGACY_DESIGN_SERVICE } from './service-type.util';

export const DEFAULT_PROFIT_MARGINS: ServiceProfitMargins = {
  impresion_3d: 40,
  diseno_grafico: 50,
  modelado: 50,
  estampado: 35,
};

function readMargin(
  raw: Record<string, ServiceProfitMargins | number | undefined>,
  key: keyof ServiceProfitMargins,
): number | undefined {
  const value = raw[key];
  if (value === undefined || value === null || value === ('' as unknown)) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.min(Math.max(parsed, 0), 999);
}

function readLegacyDesignMargin(
  raw: Record<string, ServiceProfitMargins | number | undefined>,
): number | undefined {
  const value = raw[LEGACY_DESIGN_SERVICE as keyof ServiceProfitMargins];
  if (value === undefined || value === null || value === ('' as unknown)) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.min(Math.max(parsed, 0), 999);
}

export function normalizeProfitMargins(raw: unknown): ServiceProfitMargins {
  const source =
    raw && typeof raw === 'object'
      ? (raw as Record<string, ServiceProfitMargins | number | undefined>)
      : {};
  const legacyDiseno = readLegacyDesignMargin(source);

  return {
    impresion_3d:
      readMargin(source, ServiceType.IMPRESION_3D) ??
      DEFAULT_PROFIT_MARGINS.impresion_3d,
    diseno_grafico:
      readMargin(source, ServiceType.DISENO_GRAFICO) ??
      legacyDiseno ??
      DEFAULT_PROFIT_MARGINS.diseno_grafico,
    modelado:
      readMargin(source, ServiceType.MODELADO) ??
      legacyDiseno ??
      DEFAULT_PROFIT_MARGINS.modelado,
    estampado:
      readMargin(source, ServiceType.ESTAMPADO) ??
      DEFAULT_PROFIT_MARGINS.estampado,
  };
}

export function getMarginForService(
  service: ServiceType,
  margins: ServiceProfitMargins,
): number {
  const normalized = normalizeProfitMargins(margins);
  return normalized[service as keyof ServiceProfitMargins] ?? 0;
}

export function getMarginForProductType(
  type: ProductType,
  margins: ServiceProfitMargins,
): number {
  const normalized = normalizeProfitMargins(margins);
  switch (type) {
    case ProductType.FDM:
    case ProductType.RESINA:
    case ProductType.COMBO:
      return normalized[ServiceType.IMPRESION_3D];
    case ProductType.ESTAMPADO:
      return normalized[ServiceType.ESTAMPADO];
    default:
      return 0;
  }
}

export function marginLabelForProductType(type: ProductType): string {
  switch (type) {
    case ProductType.ESTAMPADO:
      return 'Estampado';
    case ProductType.FDM:
    case ProductType.RESINA:
    case ProductType.COMBO:
    default:
      return 'Impresión 3D';
  }
}

/** Precio = costo × (1 + markup%/100). El % es ganancia sobre costo. */
export function priceFromCostAndMargin(
  cost: number,
  marginPercent: number,
): number {
  const markup = Math.min(Math.max(Number(marginPercent) || 0, 0), 999);
  if (cost <= 0) return 0;
  if (markup === 0) return Math.round(cost);
  return Math.round(cost * (1 + markup / 100));
}

export function totalCostFromBreakdown(breakdown: {
  materialCost: number;
  energyCost: number;
  machineCost: number;
  errorMarginCost: number;
  laborCost: number;
  totalCost?: number;
}): number {
  if (Number(breakdown.totalCost) > 0) {
    return Math.round(Number(breakdown.totalCost));
  }
  return Math.round(
    (Number(breakdown.materialCost) || 0) +
      (Number(breakdown.energyCost) || 0) +
      (Number(breakdown.machineCost) || 0) +
      (Number(breakdown.errorMarginCost) || 0) +
      (Number(breakdown.laborCost) || 0),
  );
}

/** Inverso de priceFromCostAndMargin: estima costo desde precio y margen del servicio. */
export function costFromPriceAndMargin(
  price: number,
  marginPercent: number,
): number {
  const markup = Math.min(Math.max(Number(marginPercent) || 0, 0), 999);
  if (price <= 0) return 0;
  if (markup === 0) return Math.round(price);
  return Math.round(price / (1 + markup / 100));
}

export function calculateErrorMarginCost(
  materialCost: number,
  energyCost: number,
  machineCost: number,
  errorMarginPercent: number,
): number {
  const percent = Math.min(
    Math.max(Number(errorMarginPercent) || 0, 0),
    100,
  );
  if (percent === 0) return 0;
  const base = materialCost + energyCost + machineCost;
  return Math.round(base * (percent / 100));
}

export function resolveProductPrice(
  input: {
    type: ProductType;
    components?: { productId: string; quantity: number }[];
    suggestedPrice?: number | null;
    price?: number;
  },
  cost: number,
  margins: ServiceProfitMargins,
  componentPricesTotal: number,
): number {
  if (
    input.suggestedPrice != null &&
    Number(input.suggestedPrice) > 0
  ) {
    return Number(input.suggestedPrice);
  }

  const hasComponents = (input.components ?? []).length > 0;
  if (hasComponents && componentPricesTotal > 0) {
    return componentPricesTotal;
  }

  const margin = getMarginForProductType(input.type, margins);
  if (cost > 0) {
    return priceFromCostAndMargin(cost, margin);
  }

  return Number(input.price) || 0;
}
