import { OrderStatus } from '../common/enums';
import { Order } from '../common/interfaces';

/** Solo los pedidos entregados suman como venta e ingreso. */
export const REVENUE_ORDER_STATUSES: OrderStatus[] = [OrderStatus.ENTREGADO];

export function isRevenueOrder(order: Order): boolean {
  return REVENUE_ORDER_STATUSES.includes(order.status);
}
