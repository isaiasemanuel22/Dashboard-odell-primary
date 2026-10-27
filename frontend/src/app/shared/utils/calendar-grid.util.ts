import { CalendarFeedItem } from '../../core/models';
import { DbCalendarDayCell } from '../../components/db-calendar-month/db-calendar-month.types';

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayYmd(reference = new Date()): string {
  return toYmd(reference);
}

export function addMonths(ymd: string, delta: number): string {
  const date = parseYmd(ymd);
  date.setMonth(date.getMonth() + delta);
  return toYmd(date);
}

export function startOfMonth(ymd: string): string {
  const date = parseYmd(ymd);
  date.setDate(1);
  return toYmd(date);
}

export function endOfMonth(ymd: string): string {
  const date = parseYmd(ymd);
  date.setMonth(date.getMonth() + 1, 0);
  return toYmd(date);
}

/** Monday-based week start for the month grid. */
export function monthGridStart(monthYmd: string): Date {
  const first = parseYmd(startOfMonth(monthYmd));
  const dow = first.getDay(); // 0 Sun
  const offset = dow === 0 ? 6 : dow - 1;
  first.setDate(first.getDate() - offset);
  return first;
}

export function formatMonthTitle(ymd: string): string {
  const date = parseYmd(ymd);
  const name = MONTH_NAMES[date.getMonth()];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${date.getFullYear()}`;
}

export function formatDayLong(ymd: string): string {
  const date = parseYmd(ymd);
  const weekday = date.toLocaleDateString('es-AR', { weekday: 'long' });
  const day = date.getDate();
  const month = date.toLocaleDateString('es-AR', { month: 'short' });
  return `${weekday} ${day} de ${month}`;
}

export function formatWhenLabel(ymd: string): string {
  const date = parseYmd(ymd);
  const weekday = date
    .toLocaleDateString('es-AR', { weekday: 'short' })
    .replace('.', '')
    .toUpperCase();
  return `${weekday} ${date.getDate()}`;
}

export function buildMonthCells(
  monthYmd: string,
  itemsByDate: Map<string, CalendarFeedItem[]>,
  today = todayYmd(),
  maxVisible = 3,
): DbCalendarDayCell[] {
  const month = parseYmd(startOfMonth(monthYmd)).getMonth();
  const start = monthGridStart(monthYmd);
  const cells: DbCalendarDayCell[] = [];

  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toYmd(date);
    const all = itemsByDate.get(key) ?? [];
    const shown = all.slice(0, maxVisible);
    const dow = date.getDay();
    const inMonth = date.getMonth() === month;
    cells.push({
      date: key,
      dayNumber: date.getDate(),
      inMonth,
      isToday: key === today,
      isWeekend: dow === 0 || dow === 6,
      items: shown,
      more: Math.max(0, all.length - shown.length),
      ariaLabel: `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}${
        all.length ? `, ${all.length} elementos` : ''
      }`,
    });
  }

  // Trim trailing empty out-of-month week if unused (keep 35 like mock when fits)
  const lastWeek = cells.slice(35);
  if (lastWeek.every((cell) => !cell.inMonth && cell.items.length === 0)) {
    return cells.slice(0, 35);
  }
  return cells;
}

export function groupItemsByDate(
  items: CalendarFeedItem[],
): Map<string, CalendarFeedItem[]> {
  const map = new Map<string, CalendarFeedItem[]>();
  for (const item of items) {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  }
  return map;
}

export function weekRangeContaining(ymd: string): { from: string; to: string } {
  const date = parseYmd(ymd);
  const dow = date.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  date.setDate(date.getDate() - offset);
  const from = toYmd(date);
  date.setDate(date.getDate() + 6);
  return { from, to: toYmd(date) };
}

export function addDaysYmd(ymd: string, days: number): string {
  const date = parseYmd(ymd);
  date.setDate(date.getDate() + days);
  return toYmd(date);
}
