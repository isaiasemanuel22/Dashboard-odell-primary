import { ServiceType } from '../common/enums';
import { WholesaleDiscountSettings } from '../common/interfaces';

export const DEFAULT_WHOLESALE_DISCOUNT: WholesaleDiscountSettings = {
  enabled: true,
  percent: 20,
  serviceTypes: [ServiceType.IMPRESION_3D, ServiceType.ESTAMPADO],
};

const VALID_SERVICE_TYPES = new Set<string>(Object.values(ServiceType));

function readPercent(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99) {
    return undefined;
  }
  return parsed;
}

function readServiceTypes(value: unknown): ServiceType[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const seen = new Set<string>();
  const result: ServiceType[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !VALID_SERVICE_TYPES.has(item)) {
      continue;
    }
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item as ServiceType);
  }
  return result;
}

/** Asegura forma y valores válidos al cargar o guardar el descuento por mayor. */
export function normalizeWholesaleDiscount(
  raw: unknown,
): WholesaleDiscountSettings {
  if (!raw || typeof raw !== 'object') {
    return {
      enabled: DEFAULT_WHOLESALE_DISCOUNT.enabled,
      percent: DEFAULT_WHOLESALE_DISCOUNT.percent,
      serviceTypes: [...DEFAULT_WHOLESALE_DISCOUNT.serviceTypes],
    };
  }

  const source = raw as Record<string, unknown>;
  return {
    enabled:
      typeof source.enabled === 'boolean'
        ? source.enabled
        : DEFAULT_WHOLESALE_DISCOUNT.enabled,
    percent: readPercent(source.percent) ?? DEFAULT_WHOLESALE_DISCOUNT.percent,
    serviceTypes: readServiceTypes(source.serviceTypes) ?? [
      ...DEFAULT_WHOLESALE_DISCOUNT.serviceTypes,
    ],
  };
}

export function appliesWholesale(
  settings: WholesaleDiscountSettings,
  serviceType: ServiceType,
): boolean {
  return (
    settings.enabled === true && settings.serviceTypes.includes(serviceType)
  );
}

/** Precio unitario mayorista; si no aplica, devuelve el precio de lista. */
export function wholesaleUnitPrice(
  listUnitPrice: number,
  settings: WholesaleDiscountSettings,
  serviceType: ServiceType,
): number {
  if (!appliesWholesale(settings, serviceType)) {
    return listUnitPrice;
  }
  return Math.round(listUnitPrice * (1 - settings.percent / 100));
}
