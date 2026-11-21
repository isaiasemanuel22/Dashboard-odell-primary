import { SalesStats } from '../../core/models';
import { formatCurrencyArs } from './currency-ars.util';
import { pluralize } from './order.helpers';

/** «4 ventas sin facturar · $ 114.500» o «Todo facturado». */
export function uninvoicedDetail(
  stats: Pick<SalesStats, 'uninvoicedCount' | 'uninvoicedRevenue'>,
): string {
  if (!stats.uninvoicedCount) return 'Todo facturado';
  return `${pluralize(stats.uninvoicedCount, 'venta sin facturar', 'ventas sin facturar')} · ${formatCurrencyArs(stats.uninvoicedRevenue)}`;
}

/** Porcentaje (0–100, entero) facturado en 12 meses contra el tope; 0 sin tope. */
export function annualCapPercent(
  stats: Pick<SalesStats, 'last12MonthsInvoicedRevenue' | 'annualInvoiceCap'>,
): number {
  const cap = Number(stats.annualInvoiceCap);
  if (!cap || cap <= 0) return 0;
  const percent = (Number(stats.last12MonthsInvoicedRevenue) / cap) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

/** Porcentaje del tope para mostrar: con un decimal si es menor a 10 %. */
export function annualCapPercentLabel(
  stats: Pick<SalesStats, 'last12MonthsInvoicedRevenue' | 'annualInvoiceCap'>,
): string {
  const cap = Number(stats.annualInvoiceCap);
  if (!cap || cap <= 0) return '0';
  const percent = Math.max(
    0,
    Math.min(100, (Number(stats.last12MonthsInvoicedRevenue) / cap) * 100),
  );
  if (percent > 0 && percent < 10) {
    return percent.toLocaleString('es-AR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }
  return String(Math.round(percent));
}
