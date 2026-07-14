import { OrderStatus } from '../common/enums';
import { Order } from '../common/interfaces';
import { ensureOrderStatusHistory } from './order-status-history.util';

export const ORDER_TERMINAL_RETENTION_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === OrderStatus.ENTREGADO || status === OrderStatus.CANCELADO;
}

/** Fecha en que el pedido pasó a entregado o cancelado (estado terminal actual). */
export function getTerminalStatusSince(order: Order): Date | null {
  if (!isTerminalOrderStatus(order.status)) {
    return null;
  }

  ensureOrderStatusHistory(order);

  const terminalEntries = order.statusHistory!.filter(
    (entry) =>
      entry.toStatus === OrderStatus.ENTREGADO ||
      entry.toStatus === OrderStatus.CANCELADO,
  );

  if (!terminalEntries.length) {
    return new Date(order.createdAt);
  }

  return terminalEntries.reduce((latest, entry) => {
    const changedAt = new Date(entry.changedAt);
    return changedAt > latest ? changedAt : latest;
  }, new Date(terminalEntries[0]!.changedAt));
}

export function shouldPurgeTerminalOrder(
  order: Order,
  now = new Date(),
  retentionDays = ORDER_TERMINAL_RETENTION_DAYS,
): boolean {
  const since = getTerminalStatusSince(order);
  if (!since) {
    return false;
  }

  const cutoff = now.getTime() - retentionDays * MS_PER_DAY;
  return since.getTime() <= cutoff;
}
