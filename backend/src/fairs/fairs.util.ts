import { toArParts } from '../common/utils/ar-date.util';
import { FairBestHour } from '../common/interfaces';

/** Redondea a centavos para evitar ruido de coma flotante. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Cuánto llevar a la feria (§26): max(ceil(promedio × 1,2), ceil(promedio) + 1)
 * para promedio > 0.
 */
export function unitsToTake(average: number): number {
  if (!(average > 0)) return 0;
  // Se redondea antes del ceil para que 5 × 1,2 no dé 6,0000000001.
  const withMargin = Math.ceil(Math.round(average * 1.2 * 1e6) / 1e6);
  const plusOne = Math.ceil(Math.round(average * 1e6) / 1e6) + 1;
  return Math.max(withMargin, plusOne);
}

/** Unidades a imprimir: lo que falta para llegar a lo que hay que llevar. */
export function unitsToPrint(take: number, stock: number): number {
  return Math.max(0, take - Math.max(0, stock));
}

/** Franja de 2 h (hora de Argentina) con más ventas; empate → la más temprana. */
export function bestTwoHourWindow(soldAt: string[]): FairBestHour | null {
  if (!soldAt.length) return null;
  const counts = new Map<number, number>();
  for (const iso of soldAt) {
    const hour = toArParts(new Date(iso)).hour;
    const start = Math.floor(hour / 2) * 2;
    counts.set(start, (counts.get(start) ?? 0) + 1);
  }
  let best: { start: number; count: number } | null = null;
  for (const [start, count] of counts) {
    if (
      !best ||
      count > best.count ||
      (count === best.count && start < best.start)
    ) {
      best = { start, count };
    }
  }
  if (!best) return null;
  const pad = (n: number) => String(n % 24).padStart(2, '0');
  return {
    from: `${pad(best.start)}:00`,
    to: `${pad(best.start + 2)}:00`,
    count: best.count,
  };
}

/** Compara nombres de feria sin distinguir mayúsculas ni espacios de más. */
export function normalizeFairName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}
