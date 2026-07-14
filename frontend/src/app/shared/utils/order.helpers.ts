import {
  Order,
  OrderItem,
  OrderLineDraft,
  OrderStatus,
  Product,
  ProductType,
  ServiceType,
} from '../../core/models';
import { ListFilterOption } from '../../components/db-list-toolbar/db-list-toolbar.component';
import { ORDER_STATUS_LABELS, SERVICE_TYPE_LABELS } from '../constants/labels';
import { labelsToSelectOptions } from './select-options';

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDIENTE,
  OrderStatus.EN_PRODUCCION,
];

export const FINISHED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETADO,
  OrderStatus.ENTREGADO,
];

export const ORDER_DESCRIPTION_MAX_LENGTH = 1000;

export function isActiveOrder(status: OrderStatus): boolean {
  return ACTIVE_ORDER_STATUSES.includes(status);
}

export function isFinishedOrder(status: OrderStatus): boolean {
  return FINISHED_ORDER_STATUSES.includes(status);
}

export function isClosedOrder(status: OrderStatus): boolean {
  return (
    status === OrderStatus.COMPLETADO ||
    status === OrderStatus.ENTREGADO ||
    status === OrderStatus.CANCELADO
  );
}

export function calculateOrderTotal(items: OrderLineDraft[] | OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function serviceTypeFromProduct(product: Product): ServiceType {
  if (product.type === ProductType.ESTAMPADO) {
    return ServiceType.ESTAMPADO;
  }
  return ServiceType.IMPRESION_3D;
}

export function isDesignService(serviceType: ServiceType): boolean {
  return serviceType === ServiceType.DISENO;
}

export function productMatchesServiceType(
  product: Product,
  serviceType: ServiceType,
): boolean {
  if (serviceType === ServiceType.DISENO) return false;
  if (serviceType === ServiceType.IMPRESION_3D) {
    return (
      product.type === ProductType.FDM || product.type === ProductType.RESINA
    );
  }
  return product.type === ProductType.ESTAMPADO;
}

export function orderIncludesService(
  order: Order,
  service: ServiceType,
): boolean {
  return order.services.includes(service);
}

export function buildOrderItems(
  lines: OrderLineDraft[],
  catalog: Product[],
): OrderItem[] {
  return lines
    .filter((line) => isLineValid(line))
    .map((line) => {
      if (isDesignService(line.serviceType)) {
        return {
          serviceType: ServiceType.DISENO,
          productName: line.customName!.trim(),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        };
      }

      const product = catalog.find((p) => p.id === line.productId);
      return {
        serviceType: line.serviceType,
        productId: line.productId,
        productName: product?.name ?? 'Producto',
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      };
    });
}

export function isLineValid(line: OrderLineDraft): boolean {
  if (!line.quantity || line.quantity <= 0) return false;
  if (line.unitPrice < 0) return false;

  if (isDesignService(line.serviceType)) {
    return !!line.customName?.trim();
  }

  return !!line.productId;
}

export function lineFromOrderItem(item: OrderItem): OrderLineDraft {
  if (isDesignService(item.serviceType)) {
    return {
      serviceType: ServiceType.DISENO,
      customName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    };
  }

  return {
    serviceType: item.serviceType,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  };
}

export function createEmptyLine(serviceType: ServiceType): OrderLineDraft {
  return {
    serviceType,
    productId: isDesignService(serviceType) ? undefined : '',
    customName: isDesignService(serviceType) ? '' : undefined,
    quantity: 1,
    unitPrice: 0,
  };
}

export type OrderStatusFilter = OrderStatus | 'all' | 'abiertos';
export type OrderServiceFilter = ServiceType | 'all';

export function orderStatusFilters(): ListFilterOption<OrderStatusFilter>[] {
  return [
    { value: 'abiertos', label: 'Abiertos' },
    { value: 'all', label: 'Todos' },
    ...labelsToSelectOptions(ORDER_STATUS_LABELS),
  ];
}

export function matchesOrderStatusFilter(
  status: OrderStatus,
  filter: OrderStatusFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'abiertos') return !isClosedOrder(status);
  return status === filter;
}

export function orderServiceFilters(): ListFilterOption<OrderServiceFilter>[] {
  return [
    { value: 'all', label: 'Todos' },
    ...labelsToSelectOptions(SERVICE_TYPE_LABELS),
  ];
}

export function serviceTypeOptions(): { value: ServiceType; label: string }[] {
  return labelsToSelectOptions(SERVICE_TYPE_LABELS);
}

export function orderStatusOptions(): { value: OrderStatus; label: string }[] {
  return labelsToSelectOptions(ORDER_STATUS_LABELS);
}

export function defaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function toDateInputValue(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export function toOrderDueDate(dateValue: string): string {
  return new Date(`${dateValue}T18:00:00.000Z`).toISOString();
}
