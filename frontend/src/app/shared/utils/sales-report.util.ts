import { SaleEntry, SalesStats } from '../../core/models';
import { SALE_SOURCE_LABELS } from '../constants/labels';

function csvCell(value: string | number): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatItems(entry: SaleEntry): string {
  return entry.items
    .map((item) => `${item.quantity}× ${item.productName}`)
    .join('; ');
}

function currentMonthLabel(): string {
  const now = new Date();
  return now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

function currentMonthFileSuffix(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function downloadSalesReportCsv(
  stats: SalesStats,
  entries: SaleEntry[],
): void {
  const rows: string[][] = [
    ['Reporte de ventas', currentMonthLabel()],
    [],
    ['Ingresos del mes', String(stats.monthlyRevenue)],
    ['Costos del mes', String(stats.monthlyCost)],
    ['Ganancias del mes', String(stats.monthlyProfit)],
    ['Ingresos de pedidos', String(stats.monthlyOrdersRevenue)],
    ['Ingresos de ventas', String(stats.monthlyRetailRevenue)],
    [],
    [
      'ID',
      'Origen',
      'Fecha',
      'Cliente',
      'Detalle',
      'Total',
      'Costo',
      'Ganancia',
    ],
  ];

  for (const entry of entries) {
    rows.push([
      entry.saleId,
      SALE_SOURCE_LABELS[entry.source],
      new Date(entry.soldAt).toLocaleDateString('es-AR'),
      entry.customerName ?? '',
      formatItems(entry),
      String(entry.total),
      String(entry.cost),
      String(entry.profit),
    ]);
  }

  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte-ventas-${currentMonthFileSuffix()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
