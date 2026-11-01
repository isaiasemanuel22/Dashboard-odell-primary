import {
  OrderLineDraft,
  PriceType,
  WholesaleDiscountSettings,
} from '../../core/models';
import { isDesignService } from './service-type.util';
import { wholesalePriceFromList } from './wholesale-example.util';

/** Precio de lista editable/visible: listUnitPrice ?? unitPrice (o design). */
export function lineListUnitPrice(line: OrderLineDraft): number {
  // `null` no cuenta como precio de lista (Number(null) daría 0).
  if (line.listUnitPrice != null) {
    const fromList = Number(line.listUnitPrice);
    if (Number.isFinite(fromList) && fromList >= 0) {
      return fromList;
    }
  }
  if (isDesignService(line.serviceType)) {
    return Number(line.designUnitPrice ?? line.unitPrice) || 0;
  }
  return Number(line.unitPrice) || 0;
}

export function wholesaleAppliesToService(
  serviceType: OrderLineDraft['serviceType'],
  settings: WholesaleDiscountSettings | null | undefined,
): boolean {
  if (!settings?.enabled) return false;
  return settings.serviceTypes.includes(serviceType);
}

export function meetsWholesaleMinimum(
  listSubtotal: number,
  minimum: number | null | undefined,
): boolean {
  if (minimum == null || !Number.isFinite(Number(minimum))) {
    return true;
  }
  return listSubtotal >= Number(minimum);
}

/** Si el backend aplicaría mayorista con este priceType + mínimo + ajustes. */
export function wouldApplyWholesale(input: {
  priceType: PriceType;
  listSubtotal: number;
  customerMinimum?: number | null;
  settings: WholesaleDiscountSettings | null | undefined;
}): boolean {
  if (input.priceType !== PriceType.MAYORISTA) return false;
  if (!input.settings?.enabled) return false;
  return meetsWholesaleMinimum(input.listSubtotal, input.customerMinimum);
}

export function linePreviewUnitPrice(
  line: OrderLineDraft,
  wholesaleApplied: boolean,
  settings: WholesaleDiscountSettings | null | undefined,
): number {
  const list = lineListUnitPrice(line);
  if (
    !wholesaleApplied ||
    !settings ||
    !wholesaleAppliesToService(line.serviceType, settings)
  ) {
    return list;
  }
  return wholesalePriceFromList(list, settings.percent);
}

export function lineListSubtotal(line: OrderLineDraft): number {
  const qty = Math.max(0, Number(line.quantity) || 0);
  return Math.round(lineListUnitPrice(line) * qty);
}

export function linePreviewSubtotal(
  line: OrderLineDraft,
  wholesaleApplied: boolean,
  settings: WholesaleDiscountSettings | null | undefined,
): number {
  const qty = Math.max(0, Number(line.quantity) || 0);
  return Math.round(linePreviewUnitPrice(line, wholesaleApplied, settings) * qty);
}

/** Margen por mayor sobre el COSTO: (precioMayor − costo) / costo × 100. */
export function wholesaleMarginPercentOnCost(
  wholesaleUnitPrice: number,
  unitCost: number,
): number {
  const cost = Math.round(Number(unitCost) || 0);
  if (!(cost > 0)) return 0;
  const profit = Math.round(Number(wholesaleUnitPrice) || 0) - cost;
  return Math.round((profit / cost) * 100);
}

/** True si el margen por mayor sobre el costo queda bajo el margen del área. */
export function isWholesaleMarginBelowArea(
  wholesaleUnitPrice: number,
  unitCost: number,
  areaMarginPercent: number,
): boolean {
  const area = Number(areaMarginPercent);
  if (!Number.isFinite(area)) return false;
  return wholesaleMarginPercentOnCost(wholesaleUnitPrice, unitCost) < area;
}
