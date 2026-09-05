import { OrderStatus } from '../common/enums';
import { Order } from '../common/interfaces';

/** Solo los pedidos entregados suman como venta e ingreso. */
export const REVENUE_ORDER_STATUSES: OrderStatus[] = [OrderStatus.ENTREGADO];

export function isRevenueOrder(order: Order): boolean {
  return REVENUE_ORDER_STATUSES.includes(order.status);
}

/** Fecha en que el pedido cuenta como venta: entrega real, no la fecha pactada. */
export function resolveOrderSoldAt(order: Order): string {
  const deliveries = order.deliveryHistory ?? [];
  if (deliveries.length) {
    return deliveries[deliveries.length - 1]!.deliveredAt;
  }

  const deliveredAt = (order.statusHistory ?? [])
    .filter((entry) => entry.toStatus === OrderStatus.ENTREGADO)
    .map((entry) => entry.changedAt)
    .sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    )[0];

  if (deliveredAt) {
    return deliveredAt;
  }

  return order.dueDate;
}
