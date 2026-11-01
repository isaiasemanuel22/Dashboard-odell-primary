import { PriceType } from '../common/enums';
import {
  Customer,
  OrderItem,
  QuoteItem,
  WholesaleDiscountSettings,
} from '../common/interfaces';
import { wholesaleUnitPrice } from '../settings/wholesale-discount.util';

export type WholesalePricedItem = OrderItem | QuoteItem;

export interface ApplyWholesalePricingInput {
  priceType: PriceType;
  customer?: Pick<Customer, 'wholesaleMinimum'> | null;
  settings: WholesaleDiscountSettings;
}

export interface ApplyWholesalePricingResult<T extends WholesalePricedItem> {
  items: T[];
  wholesaleApplied: boolean;
}

function listBaseUnitPrice(item: WholesalePricedItem): number {
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

  const priced = items.map((item, index) => {
    const base = bases[index];
    const next: T = { ...item, unitPrice: base };
    delete next.listUnitPrice;

    if (!wholesaleApplied) {
      return next;
    }

    if (!input.settings.serviceTypes.includes(item.serviceType)) {
      return next;
    }

    next.listUnitPrice = base;
    next.unitPrice = wholesaleUnitPrice(base, input.settings, item.serviceType);
    return next;
  });

  return { items: priced, wholesaleApplied };
}
