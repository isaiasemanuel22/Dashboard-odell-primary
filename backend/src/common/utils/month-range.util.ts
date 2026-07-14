export interface MonthRange {
  start: Date;
  end: Date;
}

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

export function isDateInMonthRange(
  date: Date,
  range: MonthRange,
): boolean {
  return date >= range.start && date <= range.end;
}
