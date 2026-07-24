import { Prisma } from '@prisma/client';
import { Order, OrderItem } from '../../common/interfaces';
import { ensureOrderStatusHistory } from '../../orders/order-status-history.util';
import { fromJson, toInputJson } from '../../prisma/json.util';

export function mapOrderItemFromDb(item: {
  serviceType: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
}): OrderItem {
  return {
    serviceType: item.serviceType as OrderItem['serviceType'],
    productId: item.productId ?? undefined,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
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
  items: Array<{
    serviceType: string;
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}): Order {
  const order: Order = {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    services: fromJson<Order['services']>(row.services),
    items: row.items.map((item) => mapOrderItemFromDb(item)),
    status: row.status as Order['status'],
    total: row.total,
    discountPercent: row.discountPercent ?? 0,
    discountAmount: row.discountAmount ?? 0,
    description: row.description ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    dueDate: row.dueDate.toISOString(),
    statusHistory: fromJson<Order['statusHistory']>(row.statusHistory) ?? [],
    priceHistory: fromJson<Order['priceHistory']>(row.priceHistory ?? []) ?? [],
  };
  ensureOrderStatusHistory(order);
  return order;
}

export function mapOrderToDb(order: Order) {
  return {
    id: order.id,
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
  };
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
  };
}
