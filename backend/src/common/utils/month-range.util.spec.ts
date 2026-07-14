import { getMonthRange, isDateInMonthRange } from './month-range.util';

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
    expect(isDateInMonthRange(new Date(2026, 6, 31, 23, 59, 59, 999), range)).toBe(
      true,
    );
    expect(isDateInMonthRange(new Date(2026, 5, 30), range)).toBe(false);
    expect(isDateInMonthRange(new Date(2026, 7, 1), range)).toBe(false);
  });
});
