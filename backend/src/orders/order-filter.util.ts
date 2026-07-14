import { OrderStatus, ServiceType } from '../common/enums';
import { Order } from '../common/interfaces';

const CLOSED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETADO,
  OrderStatus.ENTREGADO,
  OrderStatus.CANCELADO,
];

export interface OrderListFilters {
  customerId?: string;
  status?: OrderStatus;
  openOnly?: boolean;
  service?: ServiceType;
  q?: string;
}

export function isClosedOrderStatus(status: OrderStatus): boolean {
  return CLOSED_ORDER_STATUSES.includes(status);
}

export function filterOrders(orders: Order[], filters: OrderListFilters): Order[] {
  let result = orders;

  if (filters.customerId) {
    result = result.filter((order) => order.customerId === filters.customerId);
  }

  if (filters.openOnly) {
    result = result.filter((order) => !isClosedOrderStatus(order.status));
  } else if (filters.status) {
    result = result.filter((order) => order.status === filters.status);
  }

  if (filters.service) {
    result = result.filter((order) =>
      order.services.includes(filters.service!),
    );
  }

  const term = filters.q?.trim().toLowerCase();
  if (term) {
    result = result.filter((order) =>
      [
        order.id,
        order.customerName,
        order.description ?? '',
        order.notes ?? '',
        ...order.items.map((item) => item.productName),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }

  return result;
}
