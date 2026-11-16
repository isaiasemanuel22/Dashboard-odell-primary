import { arTodayKey } from './ar-date.util';
import { getMonthRange, getPeriodRange } from './month-range.util';
import { todayCalendarDay } from '../../orders/due-date.util';

describe('fechas en hora de Argentina', () => {
  // 2026-11-30 23:30 en Argentina = 2026-12-01 02:30 UTC.
  const lateNovember = new Date('2026-11-30T23:30:00-03:00');

  it('arTodayKey y todayCalendarDay usan el día de Argentina', () => {
    expect(arTodayKey(lateNovember)).toBe('2026-11-30');
    expect(todayCalendarDay(lateNovember)).toBe('2026-11-30');
  });

  it('el mes es noviembre aunque en UTC ya sea diciembre', () => {
    const range = getMonthRange(lateNovember);
    expect(range.start.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-12-01T02:59:59.999Z');
    expect(lateNovember >= range.start && lateNovember <= range.end).toBe(true);
  });

  it('trimestre y año usan límites de Argentina', () => {
    const quarter = getPeriodRange('quarter', lateNovember);
    expect(quarter.start.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(quarter.end.toISOString()).toBe('2027-01-01T02:59:59.999Z');
    const year = getPeriodRange('year', lateNovember);
    expect(year.start.toISOString()).toBe('2026-01-01T03:00:00.000Z');
    expect(year.end.toISOString()).toBe('2027-01-01T02:59:59.999Z');
  });
});
