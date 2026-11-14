import { Order, OrderPriceHistoryEntry } from '../common/interfaces';

export type OrderPriceChangeTrigger =
  | 'settings'
  | 'supply_price'
  | 'product_update'
  | 'bulk_price'
  | 'discount_change';

export function appendOrderPriceHistory(
  order: Order,
  entry: Omit<OrderPriceHistoryEntry, 'id' | 'changedAt'>,
  changedAt = new Date().toISOString(),
): void {
  if (!order.priceHistory) {
    order.priceHistory = [];
  }

  order.priceHistory.push({
    id: `${order.id}-price-${order.priceHistory.length + 1}`,
    changedAt,
    ...entry,
  });
}

export function sortOrderPriceHistory(
  history: OrderPriceHistoryEntry[],
): OrderPriceHistoryEntry[] {
  return [...history].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
  );
}

/** Texto legible del descuento del pedido ("Sin descuento", "10 %", "$500"). */
export function describeOrderDiscount(discount: {
  discountPercent?: number;
  discountAmount?: number;
}): string {
  const percent = Number(discount.discountPercent) || 0;
  const amount = Number(discount.discountAmount) || 0;
  if (percent > 0) return `${percent} %`;
  if (amount > 0) return `$${amount}`;
  return 'Sin descuento';
}
