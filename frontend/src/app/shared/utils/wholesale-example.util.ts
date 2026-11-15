import {
  ServiceProfitMargins,
  ServiceType,
  WholesaleDiscountSettings,
} from '../../core/models';
import { priceFromCostAndMargin } from './pricing.util';

/** Costo de ejemplo usado en Ajustes › Ganancias. */
export const WHOLESALE_EXAMPLE_COST = 1000;

export const DEFAULT_WHOLESALE_DISCOUNT: WholesaleDiscountSettings = {
  enabled: true,
  percent: 20,
  serviceTypes: [ServiceType.IMPRESION_3D, ServiceType.ESTAMPADO],
};

const VALID_SERVICE_TYPES = new Set<string>(Object.values(ServiceType));

/** Piso del precio mayorista: costo unitario + 10 % (§16.1). */
export const WHOLESALE_MIN_MARKUP = 10;

/** Piso = round(costo × 1,10). 0 si no hay costo. */
export function wholesaleFloorPrice(unitCost?: number | null): number {
  const cost = Number(unitCost);
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  return Math.round(cost * (1 + WHOLESALE_MIN_MARKUP / 100));
}

/**
 * Precio unitario mayorista = max(round(lista × (1 − %/100)), round(costo × 1,10)),
 * sin pasar nunca de la lista. Sin costo no hay piso.
 * Misma fórmula que `backend/src/orders/wholesale-pricing.util.ts`.
 */
export function wholesalePriceFromList(
  listUnitPrice: number,
  percent: number,
  unitCost?: number | null,
): number {
  const list = Number(listUnitPrice);
  const discount = Number(percent);
  if (!Number.isFinite(list) || list <= 0) {
    return 0;
  }
  if (!Number.isFinite(discount) || discount <= 0) {
    return Math.round(list);
  }
  const discounted = Math.round(list * (1 - discount / 100));
  const floor = wholesaleFloorPrice(unitCost);
  return Math.min(Math.round(list), Math.max(discounted, floor));
}

/** True si el piso (costo + 10 %) subió el precio mayorista por encima del descuento. */
export function wholesaleFloorApplied(
  listUnitPrice: number,
  percent: number,
  unitCost?: number | null,
): boolean {
  // Lista por debajo del costo: el piso no se pudo aplicar (solo aviso rojo).
  const cost = Number(unitCost);
  if (Number.isFinite(cost) && cost > 0 && Number(listUnitPrice) < cost) {
    return false;
  }
  const withFloor = wholesalePriceFromList(listUnitPrice, percent, unitCost);
  const without = wholesalePriceFromList(listUnitPrice, percent);
  return withFloor > without;
}

/**
 * Deduce de una línea guardada (pedido/presupuesto) si el mayorista quedó en el
 * piso: se cobra exactamente costo + 10 %, con lista igual o mayor al costo.
 * Con lista por debajo del costo el piso no se pudo aplicar.
 */
export function storedWholesaleFloorApplied(item: {
  unitPrice: number;
  listUnitPrice?: number | null;
  unitCost?: number | null;
  unitPriceManual?: boolean;
}): boolean {
  if (item.unitPriceManual) return false;
  const list = Number(item.listUnitPrice);
  const cost = Number(item.unitCost);
  if (!Number.isFinite(list) || list <= 0) return false;
  if (!Number.isFinite(cost) || cost <= 0 || list < cost) return false;
  const unit = Number(item.unitPrice);
  return unit <= list && unit === wholesaleFloorPrice(cost);
}

/** Texto chico cuando se aplicó el piso. */
export const WHOLESALE_FLOOR_NOTE =
  'Mayorista ajustado al mínimo (costo + 10 %)';

/**
 * Margen mínimo para no vender a pérdida por mayor:
 * Y = X ÷ (100 − X) × 100, redondeado.
 */
export function wholesaleBreakEvenMarginPercent(
  discountPercent: number,
): number {
  const x = Number(discountPercent);
  if (!Number.isFinite(x) || x <= 0) {
    return 0;
  }
  if (x >= 100) {
    return 0;
  }
  return Math.round((x / (100 - x)) * 100);
}

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
  const percent = Number(source['percent']);
  const rawServiceTypes = source['serviceTypes'];
  const serviceTypes = Array.isArray(rawServiceTypes)
    ? (rawServiceTypes.filter(
        (item): item is ServiceType =>
          typeof item === 'string' && VALID_SERVICE_TYPES.has(item),
      ) as ServiceType[])
    : [...DEFAULT_WHOLESALE_DISCOUNT.serviceTypes];

  const uniqueTypes = [...new Set(serviceTypes)];
  const hasServiceTypesArray = Array.isArray(rawServiceTypes);
  const enabled = source['enabled'];

  return {
    enabled:
      typeof enabled === 'boolean'
        ? enabled
        : DEFAULT_WHOLESALE_DISCOUNT.enabled,
    percent:
      Number.isFinite(percent) && percent >= 0 && percent <= 99
        ? percent
        : DEFAULT_WHOLESALE_DISCOUNT.percent,
    serviceTypes: hasServiceTypesArray
      ? uniqueTypes
      : [...DEFAULT_WHOLESALE_DISCOUNT.serviceTypes],
  };
}

export interface WholesaleCorrectExample {
  cost: number;
  marginPercent: number;
  discountPercent: number;
  listPrice: number;
  discountAmount: number;
  wholesalePrice: number;
  profit: number;
  profitPercentOnCost: number;
}

/** Ejemplo «Así se calcula»: descuento sobre el precio de lista. */
export function buildWholesaleCorrectExample(
  cost: number,
  marginPercent: number,
  discountPercent: number,
): WholesaleCorrectExample {
  const listPrice = priceFromCostAndMargin(cost, marginPercent);
  const wholesalePrice = wholesalePriceFromList(listPrice, discountPercent);
  const discountAmount = listPrice - wholesalePrice;
  const profit = wholesalePrice - Math.round(cost);
  const profitPercentOnCost =
    cost > 0 ? Math.round((profit / cost) * 100) : 0;

  return {
    cost: Math.round(cost),
    marginPercent,
    discountPercent,
    listPrice,
    discountAmount,
    wholesalePrice,
    profit,
    profitPercentOnCost,
  };
}

export interface WholesaleWrongExample {
  discountPercent: number;
  listProfit: number;
  wrongDiscountAmount: number;
  wrongPrice: number;
  wrongProfit: number;
  overpay: number;
}

/** Ejemplo «No se calcula así»: descuento erróneo sobre la ganancia. */
export function buildWholesaleWrongExample(
  cost: number,
  marginPercent: number,
  discountPercent: number,
): WholesaleWrongExample {
  const listPrice = priceFromCostAndMargin(cost, marginPercent);
  const listProfit = listPrice - Math.round(cost);
  const wrongDiscountAmount = Math.round(
    listProfit * (Number(discountPercent) / 100),
  );
  const wrongPrice = listPrice - wrongDiscountAmount;
  const wrongProfit = wrongPrice - Math.round(cost);
  const correct = buildWholesaleCorrectExample(
    cost,
    marginPercent,
    discountPercent,
  );

  return {
    discountPercent,
    listProfit,
    wrongDiscountAmount,
    wrongPrice,
    wrongProfit,
    overpay: wrongPrice - correct.wholesalePrice,
  };
}

export interface WholesaleAreaExampleRow {
  service: ServiceType;
  marginPercent: number;
  listPrice: number;
  wholesalePrice: number;
  profit: number;
  profitPercentOnCost: number;
  applies: boolean;
  wouldLose: boolean;
}

/** Filas de «Cuánto te queda por área» con costo de ejemplo fijo. */
export function buildWholesaleAreaRows(
  cost: number,
  margins: ServiceProfitMargins,
  discount: WholesaleDiscountSettings,
  services: readonly ServiceType[],
): WholesaleAreaExampleRow[] {
  return services.map((service) => {
    const marginPercent =
      margins[service as keyof ServiceProfitMargins] ?? 0;
    const listPrice = priceFromCostAndMargin(cost, marginPercent);
    const wholesalePrice = wholesalePriceFromList(
      listPrice,
      discount.percent,
    );
    const profit = wholesalePrice - Math.round(cost);
    const profitPercentOnCost =
      cost > 0 ? Math.round((profit / cost) * 100) : 0;
    const applies =
      discount.enabled === true && discount.serviceTypes.includes(service);

    return {
      service,
      marginPercent,
      listPrice,
      wholesalePrice,
      profit,
      profitPercentOnCost,
      applies,
      wouldLose: applies && profit < 0,
    };
  });
}
