import {
  getMonthRange,
  getPeriodRange,
  isDateInMonthRange,
} from './month-range.util';

describe('month-range.util', () => {
  it('getMonthRange returns the full calendar month', () => {
    const reference = new Date(2026, 6, 15, 12, 0, 0);
    const range = getMonthRange(reference);

    expect(range.start).toEqual(new Date(2026, 6, 1));
    expect(range.end).toEqual(new Date(2026, 6, 31, 23, 59, 59, 999));
  });

  it('isDateInMonthRange includes boundaries', () => {
    const range = getMonthRange(new Date(2026, 6, 10));

    expect(isDateInMonthRange(new Date(2026, 6, 1), range)).toBe(true);
    expect(
      isDateInMonthRange(new Date(2026, 6, 31, 23, 59, 59, 999), range),
    ).toBe(true);
    expect(isDateInMonthRange(new Date(2026, 5, 30), range)).toBe(false);
    expect(isDateInMonthRange(new Date(2026, 7, 1), range)).toBe(false);
  });

  it('getPeriodRange month matches getMonthRange', () => {
    const reference = new Date(2026, 10, 1, 15, 0, 0);
    expect(getPeriodRange('month', reference)).toEqual(
      getMonthRange(reference),
    );
  });

  it('getPeriodRange quarter spans the three calendar months', () => {
    const range = getPeriodRange('quarter', new Date(2026, 10, 1));

    expect(range.start).toEqual(new Date(2026, 9, 1));
    expect(range.end).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
    expect(isDateInMonthRange(new Date(2026, 9, 15), range)).toBe(true);
    expect(isDateInMonthRange(new Date(2026, 8, 30), range)).toBe(false);
  });

  it('getPeriodRange year spans the calendar year', () => {
    const range = getPeriodRange('year', new Date(2026, 5, 15));

    expect(range.start).toEqual(new Date(2026, 0, 1));
    expect(range.end).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });
});
