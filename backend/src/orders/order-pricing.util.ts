import { isDesignService, normalizeServiceType } from '../common/service-type.util';
import { OrderItem } from '../common/interfaces';

export type OrderLinePricingInput = Pick<
  OrderItem,
  'serviceType' | 'quantity' | 'unitPrice' | 'designUnitPrice' | 'includesPrint'
>;

export function resolveLinePrintUnitPrice(
  line: Pick<OrderItem, 'unitPrice' | 'designUnitPrice' | 'includesPrint'>,
): number {
  if (!line.includesPrint) return 0;

  const unitPrice = Number(line.unitPrice) || 0;
  const designUnitPrice =
    line.designUnitPrice != null ? Number(line.designUnitPrice) : null;

  if (designUnitPrice != null && unitPrice > designUnitPrice) {
    return unitPrice - designUnitPrice;
  }

  return unitPrice;
}

export function calculateOrderLineSubtotal(line: OrderLinePricingInput): number {
  const quantity = Math.max(Math.trunc(Number(line.quantity) || 0), 0);
  if (quantity <= 0) return 0;

  if (line.serviceType && isDesignService(line.serviceType)) {
    const designPrice =
      line.designUnitPrice != null
        ? Number(line.designUnitPrice) || 0
        : Number(line.unitPrice) || 0;

    if (line.includesPrint) {
      const printUnitPrice = resolveLinePrintUnitPrice(line);
      return designPrice + quantity * printUnitPrice;
    }

    return designPrice;
  }

  const unitPrice = Number(line.unitPrice) || 0;
  if (unitPrice < 0) return 0;
  return quantity * unitPrice;
}

export function calculateOrderItemsSubtotal(
  items: OrderLinePricingInput[],
): number {
  return items.reduce(
    (sum, item) => sum + calculateOrderLineSubtotal(item),
    0,
  );
}
