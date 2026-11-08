import {
  AR_OFFSET_MS,
  arDateKey,
  fromArLocal,
  toArParts,
} from '../print-jobs/printer-schedule.util';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function addCalendarParts(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number; weekday: number } {
  const base = Date.UTC(year, month - 1, day + delta);
  const d = new Date(base);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

/** YYYY-MM-DD en TZ AR a partir de un Date. */
export function arTodayKey(now = new Date()): string {
  return arDateKey(now);
}

/** Suma días corridos a una fecha YYYY-MM-DD (calendario AR). */
export function addCalendarDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = addCalendarParts(y, m, d, Math.trunc(days));
  return `${next.year}-${pad2(next.month)}-${pad2(next.day)}`;
}

function isWeekday(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5;
}

/** Resta `count` días hábiles (lun–vie) a una fecha YYYY-MM-DD AR. */
export function subtractBusinessDays(dateKey: string, count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) return dateKey;
  const [y, m, d] = dateKey.split('-').map(Number);
  let cur = addCalendarParts(y, m, d, 0);
  let left = n;
  let guard = 0;
  while (left > 0 && guard < 400) {
    guard += 1;
    cur = addCalendarParts(cur.year, cur.month, cur.day, -1);
    if (isWeekday(cur.weekday)) left -= 1;
  }
  return `${cur.year}-${pad2(cur.month)}-${pad2(cur.day)}`;
}

/**
 * Cuántos días corridos hacen falta para cubrir `businessDays` hábiles
 * a partir de `fromKey` (incluye el primer día hábil hacia adelante).
 */
export function businessDaysToCalendarDays(
  fromKey: string,
  businessDays: number,
): number {
  const n = Math.max(0, Math.trunc(businessDays));
  if (n === 0) return 0;
  const [y, m, d] = fromKey.split('-').map(Number);
  let cur = addCalendarParts(y, m, d, 0);
  let covered = 0;
  let calendar = 0;
  let guard = 0;
  // Empezar desde mañana si hoy ya pasó, pero el brief pide demora desde hoy.
  while (covered < n && guard < 400) {
    guard += 1;
    calendar += 1;
    cur = addCalendarParts(y, m, d, calendar);
    if (isWeekday(cur.weekday)) covered += 1;
  }
  return calendar;
}

/** orderBy = hoy + coversDays − demora hábil. */
export function computeOrderByDate(
  todayKey: string,
  coversDays: number | null,
  leadTimeBusinessDays: number,
): string | null {
  if (coversDays == null || !Number.isFinite(coversDays)) return null;
  const stockOut = addCalendarDaysToKey(todayKey, Math.max(0, coversDays));
  return subtractBusinessDays(stockOut, leadTimeBusinessDays);
}

/** Diff en días corridos (puede ser negativo) entre dos YYYY-MM-DD. */
export function calendarDaysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

export function parseArDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return fromArLocal(y, m, d, 0, 0, 0);
}

export { AR_OFFSET_MS, toArParts, arDateKey };
