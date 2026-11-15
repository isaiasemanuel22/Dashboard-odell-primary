import { PriceType } from '../common/enums';
import { isAreaService } from '../common/service-type.util';
import {
  Customer,
  OrderItem,
  QuoteItem,
  WholesaleDiscountSettings,
} from '../common/interfaces';
import { wholesaleUnitPrice } from '../settings/wholesale-discount.util';

/** Piso del precio mayorista: costo unitario + 10 % (§16.1). */
export const WHOLESALE_MIN_MARKUP = 10;

export type WholesalePricedItem = OrderItem | QuoteItem;

export interface ApplyWholesalePricingInput {
  priceType: PriceType;
  customer?: Pick<Customer, 'wholesaleMinimum'> | null;
  settings: WholesaleDiscountSettings;
  /** Costo unitario de la línea; sin costo (0/undefined) no hay piso. */
  resolveUnitCost?: (item: WholesalePricedItem) => number | undefined;
}

export interface ApplyWholesalePricingResult<T extends WholesalePricedItem> {
  items: T[];
  wholesaleApplied: boolean;
  /** Índices de líneas cuyo precio mayorista se subió al piso (costo + 10 %). */
  flooredIndexes: number[];
}

function listBaseUnitPrice(item: WholesalePricedItem): number {
  // Precio manual: es el precio cobrado, no hay lista a la que volver.
  if (item.unitPriceManual === true) {
    const manual = Number(item.unitPrice);
    return Number.isFinite(manual) && manual >= 0 ? manual : 0;
  }
  const fromList = Number(item.listUnitPrice);
  if (Number.isFinite(fromList) && fromList >= 0) {
    return fromList;
  }
  const charged = Number(item.unitPrice);
  return Number.isFinite(charged) && charged >= 0 ? charged : 0;
}

function meetsWholesaleMinimum(
  listSubtotal: number,
  customer?: Pick<Customer, 'wholesaleMinimum'> | null,
): boolean {
  const minimum = customer?.wholesaleMinimum;
  if (minimum == null || !Number.isFinite(Number(minimum))) {
    return true;
  }
  return listSubtotal >= Number(minimum);
}

/**
 * Aplica (o revierte) el precio mayorista sobre líneas ya cotizadas.
 * `unitPrice` queda siempre como el precio cobrado.
 * Idempotente: si la línea ya trae `listUnitPrice`, no descuenta dos veces.
 */
export function applyWholesalePricing<T extends WholesalePricedItem>(
  items: T[],
  input: ApplyWholesalePricingInput,
): ApplyWholesalePricingResult<T> {
  const bases = items.map((item) => listBaseUnitPrice(item));
  const listSubtotal = items.reduce(
    (sum, item, index) => sum + bases[index] * Number(item.quantity || 0),
    0,
  );

  const wholesaleApplied =
    input.priceType === PriceType.MAYORISTA &&
    input.settings.enabled === true &&
    meetsWholesaleMinimum(listSubtotal, input.customer);

  const flooredIndexes: number[] = [];
  const priced = items.map((item, index) => {
    const base = bases[index];
    const next: T = { ...item, unitPrice: base };
    delete next.listUnitPrice;

    if (!wholesaleApplied) {
      return next;
    }

    // Precio manual: se respeta tal cual (sin descuento ni piso).
    if (item.unitPriceManual === true) {
      return next;
    }

    // Insumo suelto y servicio de un tercero no pertenecen a un área.
    if (!isAreaService(item.serviceType)) {
      return next;
    }

    if (!input.settings.serviceTypes.includes(item.serviceType)) {
      return next;
    }

    const discounted = wholesaleUnitPrice(
      base,
      input.settings,
      item.serviceType,
    );
    const unitCost = Number(input.resolveUnitCost?.(item)) || 0;
    const floor =
      unitCost > 0
        ? Math.round(unitCost * (1 + WHOLESALE_MIN_MARKUP / 100))
        : 0;
    // Piso: nunca baja de costo + 10 %, pero tampoco supera la lista.
    const price = Math.min(base, Math.max(discounted, floor));
    if (price > discounted) flooredIndexes.push(index);

    next.listUnitPrice = base;
    next.unitPrice = price;
    return next;
  });

  return { items: priced, wholesaleApplied, flooredIndexes };
}
