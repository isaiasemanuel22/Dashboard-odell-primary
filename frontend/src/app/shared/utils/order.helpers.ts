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
import { productPhysicalStock, productStockOverview } from './stock.helpers';
import {
  isDesignPrintConfigured,
  resolveLinePrintUnitPrice,
} from './design-print.util';
import {
  isFdmQuoteConfigured,
  isImpresion3DLine,
} from './order-fdm-quote.util';
import {
  isDesignService,
  isGraphicDesignService,
  normalizeServiceType,
} from './service-type.util';

export { isDesignService, isGraphicDesignService };

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
  calculateTotalWithDiscount,
  calculateDiscountValue,
} from './discount.util';

export function calculateLinePriceTotal(
  line: Pick<
    OrderLineDraft | OrderItem,
    'serviceType' | 'quantity' | 'unitPrice' | 'designUnitPrice' | 'includesPrint'
  > &
    Partial<Pick<OrderLineDraft, 'printUnitPrice'>>,
): number {
  const quantity = Math.max(Math.trunc(Number(line.quantity) || 0), 0);
  if (quantity <= 0) return 0;

  if (isDesignService(line.serviceType)) {
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

export function calculateOrderSubtotal(
  items: OrderLineDraft[] | OrderItem[],
): number {
  return items.reduce(
    (sum, item) => sum + calculateLinePriceTotal(item),
    0,
  );
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

export function productMatchesServiceType(
  product: Product,
  serviceType: ServiceType,
): boolean {
  if (isDesignService(serviceType)) return false;
  if (serviceType === ServiceType.IMPRESION_3D) {
    return (
      product.type === ProductType.FDM || product.type === ProductType.RESINA
    );
  }
  return product.type === ProductType.ESTAMPADO;
}

export function orderLineStockHint(
  line: Pick<OrderLineDraft, 'serviceType' | 'productId' | 'quantity'>,
  product:
    | Pick<
        Product,
        'id' | 'type' | 'includesPieces' | 'components' | 'stock' | 'finishedStock'
      >
    | undefined,
  catalog?: Product[],
): string | null {
  if (isDesignService(line.serviceType) || !line.productId || !product) {
    return null;
  }

  const requested = Math.max(Math.trunc(Number(line.quantity) || 0), 0);
  if (requested <= 0) return null;

  const available = catalog?.length
    ? productStockOverview(product, undefined, catalog).physical
    : productPhysicalStock(product);
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
          serviceType: line.serviceType,
          productName: line.customName!.trim(),
          quantity: line.quantity,
          unitPrice: line.includesPrint
            ? resolveLinePrintUnitPrice(line)
            : (line.designUnitPrice ?? line.unitPrice),
          includesPrint: line.includesPrint || undefined,
          printPaperType: line.includesPrint ? line.printPaperType : undefined,
          printWidthCm: line.includesPrint ? line.printWidthCm : undefined,
          printLengthCm: line.includesPrint ? line.printLengthCm : undefined,
          printImpresoId: line.includesPrint ? line.printImpresoId : undefined,
          designUnitPrice: line.designUnitPrice ?? line.unitPrice,
        };
      }

      const product = catalog.find((p) => p.id === line.productId);
      const isCustomFdm =
        isImpresion3DLine(line.serviceType) && !line.productId?.trim();

      return {
        serviceType: line.serviceType,
        productId: line.productId?.trim() || undefined,
        productName: isCustomFdm
          ? line.customName!.trim()
          : (product?.name ?? line.customName?.trim() ?? 'Producto'),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        printTimeHours: isImpresion3DLine(line.serviceType)
          ? line.printTimeHours
          : undefined,
        grams: isImpresion3DLine(line.serviceType) ? line.grams : undefined,
        filamentType: isImpresion3DLine(line.serviceType)
          ? line.filamentType
          : undefined,
      };
    });
}

export function isLineValid(line: OrderLineDraft): boolean {
  if (!line.quantity || line.quantity <= 0) return false;
  if (line.unitPrice < 0) return false;

  if (isDesignService(line.serviceType)) {
    if (!line.customName?.trim()) return false;
    if (line.includesPrint && !isDesignPrintConfigured(line)) return false;
    return true;
  }

  if (isImpresion3DLine(line.serviceType)) {
    if (line.productId?.trim()) return true;
    return !!line.customName?.trim() && isFdmQuoteConfigured(line);
  }

  return !!line.productId?.trim();
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
  const serviceType =
    normalizeServiceType(item.serviceType) ?? item.serviceType;

  if (isDesignService(serviceType)) {
    const designUnitPrice = item.designUnitPrice ?? item.unitPrice;
    const printUnitPrice = item.includesPrint
      ? resolveLinePrintUnitPrice(item)
      : undefined;

    return {
      serviceType,
      customName: item.productName,
      quantity: item.quantity,
      unitPrice: item.includesPrint
        ? (printUnitPrice ?? item.unitPrice)
        : designUnitPrice,
      includesPrint: item.includesPrint,
      printPaperType: item.printPaperType,
      printWidthCm: item.printWidthCm,
      printLengthCm: item.printLengthCm,
      printImpresoId: item.printImpresoId,
      designUnitPrice,
      printUnitPrice,
      unitCost: undefined,
    };
  }

  return {
    serviceType: item.serviceType,
    productId: item.productId,
    customName:
      isImpresion3DLine(item.serviceType) && !item.productId
        ? item.productName
        : undefined,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    printTimeHours: item.printTimeHours,
    grams: item.grams,
    filamentType: item.filamentType,
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
