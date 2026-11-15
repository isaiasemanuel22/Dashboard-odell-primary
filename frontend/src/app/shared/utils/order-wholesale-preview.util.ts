import {
  OrderLineDraft,
  PriceType,
  WholesaleDiscountSettings,
} from '../../core/models';
import { isAreaService, isDesignService } from './service-type.util';
import {
  wholesaleFloorApplied,
  wholesalePriceFromList,
} from './wholesale-example.util';

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
  if (!isAreaService(serviceType)) return false;
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

/**
 * Precio unitario de la vista previa (misma regla que el backend):
 * precio manual tal cual; si no, max(descuento, costo + 10 %) sin pasar de la lista.
 */
export function linePreviewUnitPrice(
  line: OrderLineDraft,
  wholesaleApplied: boolean,
  settings: WholesaleDiscountSettings | null | undefined,
  unitCost?: number | null,
): number {
  const list = lineListUnitPrice(line);
  if (line.unitPriceManual) {
    return list;
  }
  if (
    !wholesaleApplied ||
    !settings ||
    !wholesaleAppliesToService(line.serviceType, settings)
  ) {
    return list;
  }
  return wholesalePriceFromList(list, settings.percent, unitCost);
}

/** True si el piso (costo + 10 %) subió el precio mayorista de la línea. */
export function lineWholesaleFloorApplied(
  line: OrderLineDraft,
  wholesaleApplied: boolean,
  settings: WholesaleDiscountSettings | null | undefined,
  unitCost?: number | null,
): boolean {
  if (line.unitPriceManual || !wholesaleApplied || !settings) return false;
  if (!wholesaleAppliesToService(line.serviceType, settings)) return false;
  return wholesaleFloorApplied(
    lineListUnitPrice(line),
    settings.percent,
    unitCost,
  );
}

export function lineListSubtotal(line: OrderLineDraft): number {
  const qty = Math.max(0, Number(line.quantity) || 0);
  return Math.round(lineListUnitPrice(line) * qty);
}

export function linePreviewSubtotal(
  line: OrderLineDraft,
  wholesaleApplied: boolean,
  settings: WholesaleDiscountSettings | null | undefined,
  unitCost?: number | null,
): number {
  const qty = Math.max(0, Number(line.quantity) || 0);
  return Math.round(
    linePreviewUnitPrice(line, wholesaleApplied, settings, unitCost) * qty,
  );
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
