import { PrintJobStatus } from '../common/enums';

/** America/Argentina/Buenos_Aires: UTC-3 fijo (sin horario de verano). */
export const AR_OFFSET_MS = -3 * 60 * 60 * 1000;

export interface PrinterWorkConfig {
  workHoursPerDay: number;
  workWeekdays: number[];
  workStartHour: string;
}

/** Jornada de un perfil print; misma regla que usaba printer-queue.service. */
export function printerWorkConfig(profile: {
  workHoursPerDay?: number;
  workWeekdays?: number[];
  workStartHour?: string;
}): PrinterWorkConfig {
  return {
    workHoursPerDay: profile.workHoursPerDay ?? 16,
    workWeekdays: profile.workWeekdays ?? [1, 2, 3, 4, 5, 6],
    workStartHour: profile.workStartHour ?? '08:00',
  };
}

export interface ScheduleJobInput {
  jobId: string;
  status: PrintJobStatus;
  estimatedHours: number;
  dueDate: string;
  startedAt?: string;
}

export interface JobScheduleResult {
  jobId: string;
  start: string | null;
  end: string | null;
  progress: number | null;
  blocked: boolean;
  readyDate: string | null;
  late: boolean;
  overdue: boolean;
}

export interface PrinterScheduleSummary {
  busyUntil: string | null;
  queuedHours: number;
  printing: boolean;
  jobs: JobScheduleResult[];
}

interface ArParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toArParts(date: Date): ArParts {
  const shifted = new Date(date.getTime() + AR_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

export function arDateKey(date: Date): string {
  const p = toArParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Interpreta componentes locales AR como instante UTC. */
export function fromArLocal(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, second) - AR_OFFSET_MS,
  );
}

function parseWorkStart(config: PrinterWorkConfig): {
  hour: number;
  minute: number;
} {
  const [hh, mm] = (config.workStartHour || '08:00').split(':').map(Number);
  return {
    hour: Number.isFinite(hh) ? hh : 8,
    minute: Number.isFinite(mm) ? mm : 0,
  };
}

function workdaySet(config: PrinterWorkConfig): Set<number> {
  return new Set(
    (config.workWeekdays?.length
      ? config.workWeekdays
      : [1, 2, 3, 4, 5, 6]
    ).map(Number),
  );
}

function dayStartMs(
  year: number,
  month: number,
  day: number,
  config: PrinterWorkConfig,
): number {
  const start = parseWorkStart(config);
  return fromArLocal(year, month, day, start.hour, start.minute, 0).getTime();
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number; weekday: number } {
  const base = Date.UTC(year, month - 1, day + delta);
  const d = new Date(base);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

/** Ventana de jornada del día calendario AR que contiene `at`, o null. */
export function workWindowContaining(
  at: Date,
  config: PrinterWorkConfig,
): { start: Date; end: Date } | null {
  const days = workdaySet(config);
  const hours = Math.max(1, Number(config.workHoursPerDay) || 16);
  const p = toArParts(at);

  // Probar el día AR actual y el anterior (jornada que cruza medianoche).
  for (const delta of [0, -1]) {
    const day = addCalendarDays(p.year, p.month, p.day, delta);
    if (!days.has(day.weekday)) continue;
    const startMs = dayStartMs(day.year, day.month, day.day, config);
    const endMs = startMs + hours * 60 * 60 * 1000;
    const t = at.getTime();
    if (t >= startMs && t < endMs) {
      return { start: new Date(startMs), end: new Date(endMs) };
    }
  }
  return null;
}

/** Próximo instante >= `from` que está dentro de una jornada laborable. */
export function nextWorkInstant(from: Date, config: PrinterWorkConfig): Date {
  const inside = workWindowContaining(from, config);
  if (inside && from.getTime() >= inside.start.getTime()) {
    return from;
  }

  const days = workdaySet(config);
  const p = toArParts(from);
  for (let i = 0; i < 14; i++) {
    const day = addCalendarDays(p.year, p.month, p.day, i);
    if (!days.has(day.weekday)) continue;
    const startMs = dayStartMs(day.year, day.month, day.day, config);
    if (startMs >= from.getTime()) {
      return new Date(startMs);
    }
    // Mismo día pero before start already handled; if from is after end, skip.
    const hours = Math.max(1, Number(config.workHoursPerDay) || 16);
    const endMs = startMs + hours * 60 * 60 * 1000;
    if (from.getTime() < endMs && from.getTime() >= startMs) {
      return from;
    }
  }
  return from;
}

/** Horas de jornada entre `from` y `to` (solo ventanas laborables). */
export function workHoursBetween(
  from: Date,
  to: Date,
  config: PrinterWorkConfig,
): number {
  if (to.getTime() <= from.getTime()) return 0;

  let cursor = nextWorkInstant(from, config);
  if (cursor.getTime() >= to.getTime()) return 0;

  let hours = 0;
  let guard = 0;
  while (cursor.getTime() < to.getTime() && guard < 400) {
    guard += 1;
    const window = workWindowContaining(cursor, config);
    if (!window) {
      cursor = nextWorkInstant(
        new Date(cursor.getTime() + 60 * 60 * 1000),
        config,
      );
      continue;
    }
    const segmentEnd = Math.min(window.end.getTime(), to.getTime());
    hours += (segmentEnd - cursor.getTime()) / (60 * 60 * 1000);
    if (segmentEnd >= to.getTime()) break;
    cursor = nextWorkInstant(window.end, config);
  }
  return hours;
}

/**
 * Agenda `hours` de trabajo a partir de `from` (o próximo inicio de jornada).
 * Parte jornadas si no alcanza el día.
 */
export function scheduleWorkHours(
  from: Date,
  hours: number,
  config: PrinterWorkConfig,
): { start: Date; end: Date } {
  const needed = Math.max(0, hours);
  if (needed === 0) {
    const start = nextWorkInstant(from, config);
    return { start, end: start };
  }

  let remaining = needed;
  let cursor = nextWorkInstant(from, config);
  const start = cursor;
  let guard = 0;

  while (remaining > 1e-9 && guard < 400) {
    guard += 1;
    const window = workWindowContaining(cursor, config);
    if (!window) {
      cursor = nextWorkInstant(
        new Date(cursor.getTime() + 60 * 60 * 1000),
        config,
      );
      continue;
    }
    const available =
      (window.end.getTime() - cursor.getTime()) / (60 * 60 * 1000);
    const use = Math.min(remaining, available);
    cursor = new Date(cursor.getTime() + use * 60 * 60 * 1000);
    remaining -= use;
    if (remaining > 1e-9) {
      cursor = nextWorkInstant(window.end, config);
    }
  }

  return { start, end: cursor };
}

function dueDateKey(dueDate: string): string {
  return dueDate.slice(0, 10);
}

function todayKey(now: Date): string {
  return arDateKey(now);
}

/**
 * Agenda pura de una cola de impresora ya ordenada.
 * `now` inyectado para tests.
 */
export function buildPrinterSchedule(
  jobs: ScheduleJobInput[],
  config: PrinterWorkConfig,
  now: Date,
): PrinterScheduleSummary {
  const today = todayKey(now);
  const results: JobScheduleResult[] = [];
  let cursor = nextWorkInstant(now, config);
  let busyUntil: string | null = null;
  let queuedHours = 0;
  let printing = false;

  for (const job of jobs) {
    const estimated = Math.max(0, Number(job.estimatedHours) || 0);
    const due = dueDateKey(job.dueDate);
    const overdue = due < today;

    if (job.status === PrintJobStatus.BLOQUEADO) {
      results.push({
        jobId: job.jobId,
        start: null,
        end: null,
        progress: null,
        blocked: true,
        readyDate: null,
        late: false,
        overdue,
      });
      continue;
    }

    if (job.status === PrintJobStatus.EN_PROCESO) {
      printing = true;
      const startedAt = job.startedAt ? new Date(job.startedAt) : now;
      const worked = workHoursBetween(startedAt, now, config);
      const progress = estimated > 0 ? Math.min(worked / estimated, 1) : 1;
      const remaining = Math.max(estimated - worked, 0);
      queuedHours += remaining;

      if (remaining <= 0) {
        const end = now;
        const readyDate = arDateKey(end);
        results.push({
          jobId: job.jobId,
          start: startedAt.toISOString(),
          end: end.toISOString(),
          progress: 1,
          blocked: false,
          readyDate,
          late: readyDate > due,
          overdue,
        });
        busyUntil = end.toISOString();
        cursor = nextWorkInstant(end, config);
        continue;
      }

      const { end } = scheduleWorkHours(now, remaining, config);
      const readyDate = arDateKey(end);
      results.push({
        jobId: job.jobId,
        start: startedAt.toISOString(),
        end: end.toISOString(),
        progress,
        blocked: false,
        readyDate,
        late: readyDate > due,
        overdue,
      });
      busyUntil = end.toISOString();
      cursor = nextWorkInstant(end, config);
      continue;
    }

    // por_hacer (u otros elegibles): secuencial
    queuedHours += estimated;
    if (estimated <= 0) {
      const start = cursor;
      const readyDate = arDateKey(start);
      results.push({
        jobId: job.jobId,
        start: start.toISOString(),
        end: start.toISOString(),
        progress: null,
        blocked: false,
        readyDate,
        late: readyDate > due,
        overdue,
      });
      busyUntil = start.toISOString();
      continue;
    }

    const { start, end } = scheduleWorkHours(cursor, estimated, config);
    const readyDate = arDateKey(end);
    results.push({
      jobId: job.jobId,
      start: start.toISOString(),
      end: end.toISOString(),
      progress: null,
      blocked: false,
      readyDate,
      late: readyDate > due,
      overdue,
    });
    busyUntil = end.toISOString();
    cursor = nextWorkInstant(end, config);
  }

  return { busyUntil, queuedHours, printing, jobs: results };
}

/** Cantidad de días laborables de la impresora en los próximos `dayCount` días (incluye hoy). */
export function countWorkdaysAhead(
  config: PrinterWorkConfig,
  now: Date,
  dayCount = 7,
): number {
  const days = workdaySet(config);
  const p = toArParts(now);
  let count = 0;
  for (let i = 0; i < dayCount; i++) {
    const day = addCalendarDays(p.year, p.month, p.day, i);
    if (days.has(day.weekday)) count += 1;
  }
  return count;
}

/** Lunes de la semana AR de `now` desplazada `weekOffset` semanas. */
export function mondayOfWeek(now: Date, weekOffset = 0): Date {
  const p = toArParts(now);
  // weekday 0=dom … 6=sáb; lunes = 1
  const daysFromMonday = (p.weekday + 6) % 7;
  const monday = addCalendarDays(
    p.year,
    p.month,
    p.day,
    -daysFromMonday + weekOffset * 7,
  );
  return fromArLocal(monday.year, monday.month, monday.day, 0, 0, 0);
}

/** Fechas lun..sáb de la semana (YYYY-MM-DD AR). */
export function weekdaysMonSat(now: Date, weekOffset = 0): string[] {
  const monday = mondayOfWeek(now, weekOffset);
  const p = toArParts(monday);
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    const day = addCalendarDays(p.year, p.month, p.day, i);
    out.push(`${day.year}-${pad2(day.month)}-${pad2(day.day)}`);
  }
  return out;
}
