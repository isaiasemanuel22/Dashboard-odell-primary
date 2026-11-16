import { fromArLocal } from './ar-date.util';
import {
  getMonthRange,
  getPeriodRange,
  isDateInMonthRange,
} from './month-range.util';

// Todas las fechas son de Argentina (UTC-3), sin importar la zona del servidor.
const ar = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) =>
  new Date(fromArLocal(y, m, d, h, min, s).getTime() + ms);

describe('month-range.util', () => {
  it('getMonthRange returns the full calendar month', () => {
    const range = getMonthRange(ar(2026, 7, 15, 12));

    expect(range.start).toEqual(ar(2026, 7, 1));
    expect(range.end).toEqual(ar(2026, 7, 31, 23, 59, 59, 999));
  });

  it('isDateInMonthRange includes boundaries', () => {
    const range = getMonthRange(ar(2026, 7, 10));

    expect(isDateInMonthRange(ar(2026, 7, 1), range)).toBe(true);
    expect(isDateInMonthRange(ar(2026, 7, 31, 23, 59, 59, 999), range)).toBe(
      true,
    );
    expect(isDateInMonthRange(ar(2026, 6, 30, 23, 59, 59), range)).toBe(false);
    expect(isDateInMonthRange(ar(2026, 8, 1), range)).toBe(false);
  });

  it('getPeriodRange month matches getMonthRange', () => {
    const reference = ar(2026, 11, 1, 15);
    expect(getPeriodRange('month', reference)).toEqual(
      getMonthRange(reference),
    );
  });

  it('getPeriodRange quarter spans the three calendar months', () => {
    const range = getPeriodRange('quarter', ar(2026, 11, 1, 12));

    expect(range.start).toEqual(ar(2026, 10, 1));
    expect(range.end).toEqual(ar(2026, 12, 31, 23, 59, 59, 999));
    expect(isDateInMonthRange(ar(2026, 10, 15), range)).toBe(true);
    expect(isDateInMonthRange(ar(2026, 9, 30), range)).toBe(false);
  });

  it('getPeriodRange year spans the calendar year', () => {
    const range = getPeriodRange('year', ar(2026, 6, 15));

    expect(range.start).toEqual(ar(2026, 1, 1));
    expect(range.end).toEqual(ar(2026, 12, 31, 23, 59, 59, 999));
  });
});
