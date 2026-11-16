import { arStartOfDay, toArParts } from './ar-date.util';

export interface MonthRange {
  start: Date;
  end: Date;
}

/** Período calendario del dashboard de rentabilidad. */
export type DashboardPeriod = 'month' | 'quarter' | 'year';

/** Todos los límites son de Argentina (UTC-3), aunque el servidor corra en UTC. */
export function getMonthRange(reference = new Date()): MonthRange {
  const { year, month } = toArParts(reference);
  return monthsRange(year, month, 1);
}

function monthsRange(year: number, month: number, months: number): MonthRange {
  return {
    start: arStartOfDay(year, month, 1),
    end: new Date(arStartOfDay(year, month + months, 1).getTime() - 1),
  };
}

/**
 * Rango del mes, trimestre o año calendario (hora AR) que contiene
 * `reference` (por defecto, hoy).
 */
export function getPeriodRange(
  period: DashboardPeriod = 'month',
  reference = new Date(),
): MonthRange {
  const { year, month } = toArParts(reference);

  if (period === 'year') {
    return monthsRange(year, 1, 12);
  }

  if (period === 'quarter') {
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    return monthsRange(year, quarterStartMonth, 3);
  }

  return getMonthRange(reference);
}

export function isDateInMonthRange(date: Date, range: MonthRange): boolean {
  return date >= range.start && date <= range.end;
}
