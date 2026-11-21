import { randomUUID } from 'crypto';
import { Order, OrderActivityEntry } from '../common/interfaces';

/** Tope del historial de actividad: se descartan las entradas más viejas. */
export const MAX_ACTIVITY_ENTRIES = 200;

/** Agrega una entrada (WhatsApp o factura) al historial del pedido. */
export function appendActivity(
  order: Order,
  entry: Omit<OrderActivityEntry, 'id' | 'at'>,
  now: Date = new Date(),
): OrderActivityEntry {
  const created: OrderActivityEntry = {
    id: `act-${randomUUID().slice(0, 8)}`,
    at: now.toISOString(),
    ...entry,
  };
  order.activityHistory = [...(order.activityHistory ?? []), created].slice(
    -MAX_ACTIVITY_ENTRIES,
  );
  return created;
}
