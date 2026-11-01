export interface MonthRange {
  start: Date;
  end: Date;
}

/** Período calendario del dashboard de rentabilidad. */
export type DashboardPeriod = 'month' | 'quarter' | 'year';

export function getMonthRange(reference = new Date()): MonthRange {
  return {
    start: new Date(reference.getFullYear(), reference.getMonth(), 1),
    end: new Date(
      reference.getFullYear(),
      reference.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ),
  };
}

/**
 * Rango del mes, trimestre o año calendario que contiene `reference`
 * (por defecto, hoy).
 */
export function getPeriodRange(
  period: DashboardPeriod = 'month',
  reference = new Date(),
): MonthRange {
  const year = reference.getFullYear();
  const month = reference.getMonth();

  if (period === 'year') {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
    };
  }

  if (period === 'quarter') {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    return {
      start: new Date(year, quarterStartMonth, 1),
      end: new Date(year, quarterStartMonth + 3, 0, 23, 59, 59, 999),
    };
  }

  return getMonthRange(reference);
}

export function isDateInMonthRange(date: Date, range: MonthRange): boolean {
  return date >= range.start && date <= range.end;
}
