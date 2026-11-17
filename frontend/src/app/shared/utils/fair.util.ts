import {
  Fair,
  FairPlanItem,
  FairStatus,
  FairSummary,
  PaymentMethod,
} from '../../core/models';

/** Efectivo que debería haber en la caja: fondo inicial + ventas en efectivo. */
export function fairExpectedCash(openingFloat: number, cashSales: number): number {
  return Math.round(((Number(openingFloat) || 0) + (Number(cashSales) || 0)) * 100) / 100;
}

/** Contado − esperado (negativo = falta plata). */
export function fairCashDifference(counted: number, expected: number): number {
  return Math.round(((Number(counted) || 0) - (Number(expected) || 0)) * 100) / 100;
}

/** El motivo es obligatorio solo si hay diferencia. */
export function fairReasonRequired(difference: number): boolean {
  return Math.abs(difference) >= 0.005;
}

/** Resultado de la feria: vendido − costo − gastos. */
export function fairResult(sold: number, cost: number, expenses: number): number {
  return Math.round((sold - cost - expenses) * 100) / 100;
}

/** YYYY-MM de una fecha local. */
export function fairMonthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Mueve un mes a otro sin saltear (día 1 para evitar desbordes). */
export function shiftFairMonth(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

/** «sáb 31/10» a partir de YYYY-MM-DD (sin corrimiento por zona horaria). */
export function formatFairDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  const date = new Date(y, m - 1, d);
  const weekday = date
    .toLocaleDateString('es-AR', { weekday: 'short' })
    .replace('.', '');
  return `${weekday} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** «sábado 07/11» */
export function formatFairDateLong(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  const weekday = new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'long',
  });
  return `${weekday} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** HH:MM local de un ISO. */
export function formatFairTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export type FairCashTone = 'ok' | 'warn' | 'info' | 'muted';

/** Qué se muestra en la columna «Caja» de la tabla. */
export function fairCashStatus(
  fair: Pick<Fair, 'status' | 'cashDifference'>,
): { label: string; tone: FairCashTone } {
  if (fair.status === 'planned') return { label: 'Planificada', tone: 'muted' };
  if (fair.status === 'open') return { label: 'Abierta', tone: 'info' };
  const diff = fair.cashDifference ?? 0;
  if (!fairReasonRequired(diff)) return { label: 'OK', tone: 'ok' };
  return { label: formatSignedAmount(diff), tone: 'warn' };
}

/** «−$ 500» / «+$ 500» con formato argentino. */
export function formatSignedAmount(value: number): string {
  const abs = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(
    Math.abs(value),
  );
  if (value < 0) return `−$ ${abs}`;
  return value > 0 ? `+$ ${abs}` : `$ ${abs}`;
}

export const FAIR_STATUS_LABELS: Record<FairStatus, string> = {
  planned: 'Planificada',
  open: 'Abierta',
  closed: 'Cerrada',
};

export const FAIR_METHOD_LABELS: Record<string, string> = {
  [PaymentMethod.EFECTIVO]: 'Efectivo',
  [PaymentMethod.MERCADO_PAGO]: 'QR Mercado Pago',
  [PaymentMethod.TRANSFERENCIA]: 'Transferencia',
};

/** Rango horario «16 a 18 h · 5 ventas». */
export function formatBestHour(
  best: { from: number; to: number; count: number } | null | undefined,
): string {
  if (!best) return '—';
  return `${best.from} a ${best.to} h · ${best.count} ${best.count === 1 ? 'venta' : 'ventas'}`;
}

/** Feria abierta si hay; si no, la planificada de hoy. */
export function pickFairForFairMode(
  fairs: Array<Pick<FairSummary, 'id' | 'status' | 'date'>>,
  today: string,
): { fair: Pick<FairSummary, 'id' | 'status' | 'date'>; needsOpening: boolean } | null {
  const open = fairs.find((f) => f.status === 'open');
  if (open) return { fair: open, needsOpening: false };
  const planned = fairs.find((f) => f.status === 'planned' && f.date === today);
  return planned ? { fair: planned, needsOpening: true } : null;
}

/** Fecha local de hoy en YYYY-MM-DD. */
export function todayIsoDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Nombre de la tarea de cola para un ítem a imprimir. */
export function fairPlanTaskName(item: Pick<FairPlanItem, 'name' | 'toPrint'>): string {
  return `Imprimir ${item.toPrint}× ${item.name}`;
}

export function fairPlanItemsToPrint(items: FairPlanItem[]): FairPlanItem[] {
  return items.filter((item) => item.toPrint > 0);
}
