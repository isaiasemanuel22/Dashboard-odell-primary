export const DUE_DATE_AFTER_TODAY_MESSAGE =
  'La fecha de entrega tiene que ser posterior a hoy';

export function calendarDay(value: string): string | null {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function todayCalendarDay(reference = new Date()): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  const day = String(reference.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDueDateAfterToday(
  value: string,
  reference = new Date(),
): boolean {
  const day = calendarDay(value);
  if (!day) return false;
  return day > todayCalendarDay(reference);
}
