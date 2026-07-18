import {
  ProductType,
  ServiceProfitMargins,
  ServiceType,
} from '../../core/models';

export const DEFAULT_PROFIT_MARGINS: ServiceProfitMargins = {
  impresion_3d: 40,
  diseno: 50,
  estampado: 35,
};

function readMargin(
  raw: Record<string, ServiceProfitMargins | number | undefined>,
  service: ServiceType,
): number | undefined {
  const value = raw[service];
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

  return {
    impresion_3d:
      readMargin(source, ServiceType.IMPRESION_3D) ??
      DEFAULT_PROFIT_MARGINS.impresion_3d,
    diseno:
      readMargin(source, ServiceType.DISENO) ??
      DEFAULT_PROFIT_MARGINS.diseno,
    estampado:
      readMargin(source, ServiceType.ESTAMPADO) ??
      DEFAULT_PROFIT_MARGINS.estampado,
  };
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
