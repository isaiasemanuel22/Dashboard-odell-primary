import {
  formatScheduleRange,
  todayArYmd,
} from './printer-queue-format.util';

describe('formatScheduleRange', () => {
  const today = todayArYmd();

  function isoOnArDay(ymd: string, hhmm: string): string {
    return `${ymd}T${hhmm}:00.000-03:00`;
  }

  it('mismo día (hoy): solo horas', () => {
    const start = isoOnArDay(today, '10:00');
    const end = isoOnArDay(today, '12:15');
    expect(formatScheduleRange(start, end, false)).toBe('10:00 – 12:15');
  });

  it('fin en otro día: muestra día en inicio y fin', () => {
    const start = isoOnArDay('2026-11-07', '22:15');
    const end = isoOnArDay('2026-11-09', '12:15');
    expect(formatScheduleRange(start, end, false)).toBe(
      'Sáb 07/11 · 22:15 – Lun 09/11 · 12:15',
    );
  });

  it('en curso termina hoy: Ahora · termina HH:mm', () => {
    const start = isoOnArDay(today, '08:00');
    const end = isoOnArDay(today, '12:16');
    expect(formatScheduleRange(start, end, true)).toBe('Ahora · termina 12:16');
  });

  it('en curso termina otro día: Ahora · termina día · hora', () => {
    // Fechas lejanas para no coincidir con «hoy» del runner.
    const start = isoOnArDay('2099-01-04', '22:00');
    const end = isoOnArDay('2099-01-05', '12:16');
    expect(formatScheduleRange(start, end, true)).toBe(
      'Ahora · termina lun 05/01 · 12:16',
    );
  });
});
