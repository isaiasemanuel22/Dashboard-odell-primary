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
