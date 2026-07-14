import { OrderStatus } from '../common/enums';
import { Order, OrderStatusHistoryEntry } from '../common/interfaces';

export type OrderStatusChangeSource = OrderStatusHistoryEntry['source'];

export function appendOrderStatusHistory(
  order: Order,
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus,
  source: OrderStatusChangeSource,
  changedAt?: string,
): void {
  if (fromStatus === toStatus) return;

  if (!order.statusHistory) {
    order.statusHistory = [];
  }

  order.statusHistory.push({
    id: `${order.id}-hist-${order.statusHistory.length + 1}`,
    fromStatus,
    toStatus,
    changedAt: changedAt ?? new Date().toISOString(),
    source,
  });
}

/** Pedidos legacy sin historial: una entrada inferida al estado actual. */
export function ensureOrderStatusHistory(order: Order): void {
  if (order.statusHistory?.length) return;

  order.statusHistory = [
    {
      id: `${order.id}-hist-1`,
      fromStatus: null,
      toStatus: order.status,
      changedAt: order.createdAt,
      source: 'manual',
    },
  ];
}

export function sortStatusHistoryNewestFirst(
  history: OrderStatusHistoryEntry[],
): OrderStatusHistoryEntry[] {
  return [...history].sort(
    (a, b) =>
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
  );
}
