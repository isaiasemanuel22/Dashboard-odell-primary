import { CalendarRepeat as Repeat } from '../common/enums';
import { CalendarEntry } from '../common/interfaces';

/** Monday=1 … Sunday=7 */
export function weekdayFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const js = new Date(y, m - 1, d).getDay(); // 0=Sun
  return js === 0 ? 7 : js;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function eachDayInclusive(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return days;
}

/**
 * Expand a calendar entry into concrete dates within [from, to].
 */
export function expandEntryDates(
  entry: CalendarEntry,
  from: string,
  to: string,
): string[] {
  const start = entry.date;
  if (entry.repeat === Repeat.NONE || !entry.repeat) {
    if (start >= from && start <= to) return [start];
    return [];
  }

  const rangeDays = eachDayInclusive(from, to);
  const weekdays =
    entry.weekdays?.length > 0
      ? new Set(entry.weekdays)
      : new Set([weekdayFromYmd(start)]);

  if (entry.repeat === Repeat.WEEKLY) {
    return rangeDays.filter((day) => {
      if (day < start) return false;
      return weekdays.has(weekdayFromYmd(day));
    });
  }

  if (entry.repeat === Repeat.MONTHLY) {
    const dayOfMonth = Number(start.slice(8, 10));
    return rangeDays.filter((day) => {
      if (day < start) return false;
      return Number(day.slice(8, 10)) === dayOfMonth;
    });
  }

  if (entry.repeat === Repeat.YEARLY) {
    const md = start.slice(5);
    return rangeDays.filter((day) => day >= start && day.slice(5) === md);
  }

  return [];
}
