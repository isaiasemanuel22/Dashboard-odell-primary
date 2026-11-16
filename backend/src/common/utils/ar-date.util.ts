import {
  arDateKey,
  fromArLocal,
  toArParts,
} from '../../print-jobs/printer-schedule.util';

/**
 * Fechas en hora de Argentina (UTC-3, sin horario de verano), sin importar la
 * zona del servidor. Reusa los helpers de `printer-schedule.util`.
 */
export { arDateKey, fromArLocal, toArParts };

/** YYYY-MM-DD del día calendario de Argentina. */
export function arTodayKey(reference = new Date()): string {
  return arDateKey(reference);
}

/** Inicio (00:00 AR) del día `day` del mes `month` (1–12) de `year`. */
export function arStartOfDay(year: number, month: number, day: number): Date {
  return fromArLocal(year, month, day, 0, 0, 0);
}

/** Último instante (23:59:59.999 AR) del día indicado. */
export function arEndOfDay(year: number, month: number, day: number): Date {
  return new Date(fromArLocal(year, month, day + 1, 0, 0, 0).getTime() - 1);
}
