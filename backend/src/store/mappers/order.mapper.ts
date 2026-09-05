import { Prisma } from '@prisma/client';
import { OrderStatus } from '../../common/enums';
import { Order, OrderItem } from '../../common/interfaces';
import { ensureOrderStatusHistory } from '../../orders/order-status-history.util';
import { fromJson, toInputJson } from '../../prisma/json.util';
import { normalizeServiceType } from '../../common/service-type.util';

function normalizeOrderStatus(status: string): OrderStatus {
  if (status === 'en_produccion') return OrderStatus.EN_PROGRESO;
  if (status === 'completado') return OrderStatus.TERMINADO;
  return status as OrderStatus;
}

export function mapOrderItemFromDb(item: {
  serviceType: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  includesPrint?: boolean;
  printPaperType?: string | null;
  printWidthCm?: number | null;
  printLengthCm?: number | null;
  printImpresoId?: string | null;
  designUnitPrice?: number | null;
  printTimeHours?: number | null;
  grams?: number | null;
  filamentType?: string | null;
  deliveredQuantity?: number;
  reservedQuantity?: number;
  productionRequiredQuantity?: number;
  producedQuantity?: number;
  deliveredFromProductionQuantity?: number;
}): OrderItem {
  return {
    serviceType:
      normalizeServiceType(item.serviceType) ??
      (item.serviceType as OrderItem['serviceType']),
    productId: item.productId ?? undefined,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    includesPrint: item.includesPrint ?? undefined,
    printPaperType: (item.printPaperType as OrderItem['printPaperType']) ?? undefined,
    printWidthCm: item.printWidthCm ?? undefined,
    printLengthCm: item.printLengthCm ?? undefined,
    printImpresoId: item.printImpresoId ?? undefined,
    designUnitPrice: item.designUnitPrice ?? undefined,
    printTimeHours: item.printTimeHours ?? undefined,
    grams: item.grams ?? undefined,
    filamentType: (item.filamentType as OrderItem['filamentType']) ?? undefined,
    deliveredQuantity: item.deliveredQuantity ?? 0,
    reservedQuantity: item.reservedQuantity ?? 0,
    productionRequiredQuantity: item.productionRequiredQuantity ?? 0,
    producedQuantity: item.producedQuantity ?? 0,
    deliveredFromProductionQuantity:
      item.deliveredFromProductionQuantity ?? 0,
  };
}

export function mapOrderFromDb(row: {
  id: string;
  customerId: string | null;
  customerName: string;
  services: Prisma.JsonValue;
  status: string;
  total: number;
  discountPercent?: number;
  discountAmount?: number;
  description: string | null;
  notes: string | null;
  createdAt: Date;
  dueDate: Date;
  statusHistory: Prisma.JsonValue;
  priceHistory?: Prisma.JsonValue;
  deliveryHistory?: Prisma.JsonValue;
  items: Array<{
    serviceType: string;
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    printImpresoId?: string | null;
    designUnitPrice?: number | null;
    deliveredQuantity?: number;
    reservedQuantity?: number;
    productionRequiredQuantity?: number;
    producedQuantity?: number;
    deliveredFromProductionQuantity?: number;
  }>;
}): Order {
  const order: Order = {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    services: fromJson<Order['services']>(row.services),
    items: row.items.map((item) => mapOrderItemFromDb(item)),
    status: normalizeOrderStatus(row.status),
    total: row.total,
    discountPercent: row.discountPercent ?? 0,
    discountAmount: row.discountAmount ?? 0,
    description: row.description ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    dueDate: row.dueDate.toISOString(),
    statusHistory: fromJson<Order['statusHistory']>(row.statusHistory) ?? [],
    priceHistory: fromJson<Order['priceHistory']>(row.priceHistory ?? []) ?? [],
    deliveryHistory:
      fromJson<Order['deliveryHistory']>(row.deliveryHistory ?? []) ?? [],
  };
  ensureOrderStatusHistory(order);
  return order;
}

function mapOrderScalarsToDb(order: Order) {
  return {
    customerId: order.customerId,
    customerName: order.customerName,
    services: toInputJson(order.services),
    status: order.status,
    total: order.total,
    discountPercent: order.discountPercent ?? 0,
    discountAmount: order.discountAmount ?? 0,
    description: order.description ?? null,
    notes: order.notes ?? null,
    createdAt: new Date(order.createdAt),
    dueDate: new Date(order.dueDate),
    statusHistory: toInputJson(order.statusHistory ?? []),
    priceHistory: toInputJson(order.priceHistory ?? []),
    deliveryHistory: toInputJson(order.deliveryHistory ?? []),
  };
}

/** Usa campos escalares (unchecked) para evitar ambigüedad con relaciones en upsert. */
export function mapOrderToDbCreate(order: Order): Prisma.OrderUncheckedCreateInput {
  return {
    id: order.id,
    ...mapOrderScalarsToDb(order),
  };
}

export function mapOrderToDbUpdate(order: Order): Prisma.OrderUncheckedUpdateInput {
  return mapOrderScalarsToDb(order);
}

export function mapOrderItemToDb(orderId: string, index: number, item: OrderItem) {
  return {
    id: `${orderId}-item-${index}`,
    orderId,
    sortIndex: index,
    serviceType: item.serviceType,
    productId: item.productId ?? null,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    includesPrint: item.includesPrint ?? false,
    printPaperType: item.printPaperType ?? null,
    printWidthCm: item.printWidthCm ?? null,
    printLengthCm: item.printLengthCm ?? null,
    printImpresoId: item.printImpresoId ?? null,
    designUnitPrice: item.designUnitPrice ?? null,
    printTimeHours: item.printTimeHours ?? null,
    grams: item.grams ?? null,
    filamentType: item.filamentType ?? null,
    deliveredQuantity: item.deliveredQuantity ?? 0,
    reservedQuantity: item.reservedQuantity ?? 0,
    productionRequiredQuantity: item.productionRequiredQuantity ?? 0,
    producedQuantity: item.producedQuantity ?? 0,
    deliveredFromProductionQuantity:
      item.deliveredFromProductionQuantity ?? 0,
  };
}
