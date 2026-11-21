import { OrderStatus } from '../common/enums';
import { arTodayKey } from '../common/utils/ar-date.util';

export const DUE_DATE_AFTER_TODAY_MESSAGE =
  'La fecha de entrega tiene que ser posterior a hoy';

export function calendarDay(value: string): string | null {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function todayCalendarDay(reference = new Date()): string {
  return arTodayKey(reference);
}

export function isDueDateAfterToday(
  value: string,
  reference = new Date(),
): boolean {
  const day = calendarDay(value);
  if (!day) return false;
  return day > todayCalendarDay(reference);
}

type DueOrder = { status: OrderStatus; dueDate: string };

function isOpenOrder(order: DueOrder): boolean {
  return (
    order.status !== OrderStatus.ENTREGADO &&
    order.status !== OrderStatus.CANCELADO
  );
}

/** Pedido abierto cuya fecha de entrega ya pasó (día de Argentina). */
export function isOrderOverdue(order: DueOrder, now = new Date()): boolean {
  if (!isOpenOrder(order)) return false;
  const dueDay = calendarDay(order.dueDate);
  if (!dueDay) return false;
  return dueDay < arTodayKey(now);
}

/** Pedido abierto que vence el día `dayKey` (YYYY-MM-DD). */
export function isOrderDueOn(order: DueOrder, dayKey: string): boolean {
  return isOpenOrder(order) && calendarDay(order.dueDate) === dayKey;
}
