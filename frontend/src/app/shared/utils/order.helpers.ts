import {
  Order,
  OrderItem,
  OrderItemPayload,
  OrderLineDraft,
  OrderStatus,
  Product,
  ProductType,
  ServiceType,
} from '../../core/models';
import { ListFilterOption } from '../../components/db-list-toolbar/db-list-toolbar.component';
import { ORDER_STATUS_LABELS, SERVICE_TYPE_LABELS } from '../constants/labels';
import { labelsToSelectOptions } from './select-options';
import { productPhysicalStock } from './stock.helpers';

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDIENTE,
  OrderStatus.EN_PROGRESO,
];

export const FINISHED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.TERMINADO,
  OrderStatus.PARCIALMENTE_ENTREGADO,
  OrderStatus.ENTREGADO,
];

export const ORDER_DESCRIPTION_MAX_LENGTH = 20_000;

export function isActiveOrder(status: OrderStatus): boolean {
  return ACTIVE_ORDER_STATUSES.includes(status);
}

export function isFinishedOrder(status: OrderStatus): boolean {
  return FINISHED_ORDER_STATUSES.includes(status);
}

export function isClosedOrder(status: OrderStatus): boolean {
  return (
    status === OrderStatus.TERMINADO ||
    status === OrderStatus.PARCIALMENTE_ENTREGADO ||
    status === OrderStatus.ENTREGADO ||
    status === OrderStatus.CANCELADO
  );
}

import {
  calculateItemsSubtotal,
  calculateTotalWithDiscount,
  calculateDiscountValue,
} from './discount.util';

export function calculateOrderSubtotal(
  items: OrderLineDraft[] | OrderItem[],
): number {
  return calculateItemsSubtotal(items);
}

export function calculateLinePriceTotal(
  line: Pick<OrderLineDraft, 'quantity' | 'unitPrice'>,
): number {
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPrice) || 0;
  if (quantity <= 0 || unitPrice < 0) return 0;
  return quantity * unitPrice;
}

export function isLineBillable(line: OrderLineDraft): boolean {
  return calculateLinePriceTotal(line) > 0;
}

export function calculateOrderTotal(
  items: OrderLineDraft[] | OrderItem[],
  discountPercent = 0,
  discountAmount = 0,
): number {
  return calculateTotalWithDiscount(
    calculateOrderSubtotal(items),
    discountPercent,
    discountAmount,
  );
}

export function calculateOrderDiscount(
  items: OrderLineDraft[] | OrderItem[],
  discountPercent = 0,
  discountAmount = 0,
): number {
  return calculateDiscountValue(
    calculateOrderSubtotal(items),
    discountPercent,
    discountAmount,
  );
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

export function orderLineStockHint(
  line: Pick<OrderLineDraft, 'serviceType' | 'productId' | 'quantity'>,
  product: Pick<Product, 'stock' | 'finishedStock'> | undefined,
): string | null {
  if (isDesignService(line.serviceType) || !line.productId || !product) {
    return null;
  }

  const requested = Math.max(Math.trunc(Number(line.quantity) || 0), 0);
  if (requested <= 0) return null;

  const available = productPhysicalStock(product);
  if (requested <= available) return null;

  if (available === 0) {
    return 'Sin stock disponible: al confirmar se creará una tarea de producción.';
  }

  return `Stock insuficiente (${available} disponible): faltan ${requested - available} unidades por producir.`;
}

export function deriveOrderServices(
  lines: Array<{ serviceType: ServiceType }>,
): ServiceType[] {
  return [...new Set(lines.map((line) => line.serviceType))];
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
): OrderItemPayload[] {
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

export function orderLinesFromSaleCart(
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>,
  products: Product[],
): OrderLineDraft[] {
  return lines.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    return {
      serviceType: product
        ? serviceTypeFromProduct(product)
        : ServiceType.IMPRESION_3D,
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    };
  });
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
    unitCost: isDesignService(serviceType) ? 0 : undefined,
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
