import { Order, OrderPriceHistoryEntry } from '../common/interfaces';

export type OrderPriceChangeTrigger =
  | 'settings'
  | 'supply_price'
  | 'product_update';

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
