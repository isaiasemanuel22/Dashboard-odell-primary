import { PrintJobStatus } from '../common/enums';
import {
  buildPrinterSchedule,
  nextWorkInstant,
  scheduleWorkHours,
  toArParts,
  workHoursBetween,
  workWindowContaining,
} from './printer-schedule.util';

const CONFIG = {
  workHoursPerDay: 16,
  workWeekdays: [1, 2, 3, 4, 5, 6],
  workStartHour: '08:00',
};

/** Viernes 2026-03-06 10:00 AR = 13:00 UTC */
const FRI_10 = new Date('2026-03-06T13:00:00.000Z');
/** Viernes 2026-03-06 08:00 AR */
const FRI_08 = new Date('2026-03-06T11:00:00.000Z');
/** Sábado 2026-03-07 01:00 AR (fuera de jornada; antes de 08:00) */
const SAT_01 = new Date('2026-03-07T04:00:00.000Z');
/** Domingo 2026-03-08 12:00 AR */
const SUN_12 = new Date('2026-03-08T15:00:00.000Z');

describe('printer-schedule.util', () => {
  it('interpreta componentes en TZ AR (UTC-3)', () => {
    const parts = toArParts(FRI_10);
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(3);
    expect(parts.day).toBe(6);
    expect(parts.hour).toBe(10);
    expect(parts.weekday).toBe(5);
  });

  it('corta la jornada: 6h desde 20:00 AR terminan a las 24:00 y el resto al día siguiente 08:00', () => {
    // Viernes 20:00 AR = 23:00 UTC; quedan 4h de jornada (hasta 24:00)
    const from = new Date('2026-03-06T23:00:00.000Z');
    const { start, end } = scheduleWorkHours(from, 6, CONFIG);
    expect(start.toISOString()).toBe('2026-03-06T23:00:00.000Z');
    // 4h vie + 2h sáb 08:00 → 10:00 AR = 13:00 UTC
    expect(end.toISOString()).toBe('2026-03-07T13:00:00.000Z');
  });

  it('salta el domingo al programar', () => {
    // Sábado 20:00 AR: quedan 4h; resto el lunes 08:00
    const from = new Date('2026-03-07T23:00:00.000Z');
    const { end } = scheduleWorkHours(from, 6, CONFIG);
    // 4h sáb → 24:00; 2h lun 08:00 → 10:00 AR = 13:00 UTC 2026-03-09
    expect(end.toISOString()).toBe('2026-03-09T13:00:00.000Z');
  });

  it('now fuera de jornada arranca en el próximo inicio', () => {
    expect(nextWorkInstant(SAT_01, CONFIG).toISOString()).toBe(
      '2026-03-07T11:00:00.000Z',
    );
    expect(nextWorkInstant(SUN_12, CONFIG).toISOString()).toBe(
      '2026-03-09T11:00:00.000Z',
    );
  });

  it('en_proceso a mitad: progress y restante desde now', () => {
    // Empezó viernes 08:00; now viernes 10:00 → 2h trabajadas de 8
    const schedule = buildPrinterSchedule(
      [
        {
          jobId: 'j1',
          status: PrintJobStatus.EN_PROCESO,
          estimatedHours: 8,
          dueDate: '2026-03-10',
          startedAt: FRI_08.toISOString(),
        },
      ],
      CONFIG,
      FRI_10,
    );
    expect(schedule.printing).toBe(true);
    expect(schedule.queuedHours).toBe(6);
    expect(schedule.jobs[0].progress).toBeCloseTo(0.25);
    expect(schedule.jobs[0].start).toBe(FRI_08.toISOString());
    // 6h desde 10:00 → 16:00 AR = 19:00 UTC
    expect(schedule.jobs[0].end).toBe('2026-03-06T19:00:00.000Z');
    expect(schedule.jobs[0].readyDate).toBe('2026-03-06');
    expect(schedule.busyUntil).toBe('2026-03-06T19:00:00.000Z');
  });

  it('bloqueada no consume horas y mantiene el lugar', () => {
    const schedule = buildPrinterSchedule(
      [
        {
          jobId: 'blocked',
          status: PrintJobStatus.BLOQUEADO,
          estimatedHours: 10,
          dueDate: '2026-03-10',
        },
        {
          jobId: 'next',
          status: PrintJobStatus.POR_HACER,
          estimatedHours: 2,
          dueDate: '2026-03-10',
        },
      ],
      CONFIG,
      FRI_10,
    );
    expect(schedule.jobs[0].blocked).toBe(true);
    expect(schedule.jobs[0].start).toBeNull();
    expect(schedule.jobs[0].end).toBeNull();
    expect(schedule.queuedHours).toBe(2);
    expect(schedule.jobs[1].start).toBe(FRI_10.toISOString());
    expect(schedule.jobs[1].end).toBe('2026-03-06T15:00:00.000Z');
  });

  it('cola vacía', () => {
    const schedule = buildPrinterSchedule([], CONFIG, FRI_10);
    expect(schedule.busyUntil).toBeNull();
    expect(schedule.queuedHours).toBe(0);
    expect(schedule.printing).toBe(false);
    expect(schedule.jobs).toEqual([]);
  });

  it('workHoursBetween solo cuenta jornada', () => {
    // Vie 20:00 → Sáb 10:00 AR: 4h vie + 2h sáb = 6
    const from = new Date('2026-03-06T23:00:00.000Z');
    const to = new Date('2026-03-07T13:00:00.000Z');
    expect(workHoursBetween(from, to, CONFIG)).toBeCloseTo(6);
  });

  it('workWindowContaining null fuera de jornada', () => {
    expect(workWindowContaining(SAT_01, CONFIG)).toBeNull();
    expect(workWindowContaining(SUN_12, CONFIG)).toBeNull();
    const win = workWindowContaining(FRI_10, CONFIG);
    expect(win?.start.toISOString()).toBe('2026-03-06T11:00:00.000Z');
    expect(win?.end.toISOString()).toBe('2026-03-07T03:00:00.000Z');
  });

  it('late y overdue según dueDate', () => {
    const schedule = buildPrinterSchedule(
      [
        {
          jobId: 'late',
          status: PrintJobStatus.POR_HACER,
          estimatedHours: 20,
          dueDate: '2026-03-06',
        },
      ],
      CONFIG,
      FRI_10,
    );
    // 20h desde 10:00: 14h vie + 6h sáb → ready sáb
    expect(schedule.jobs[0].readyDate).toBe('2026-03-07');
    expect(schedule.jobs[0].late).toBe(true);
    expect(schedule.jobs[0].overdue).toBe(false);
  });
});
