import type { SheetData } from 'write-excel-file/browser';
import { SaleEntry } from '../../core/models';
import { SALE_SOURCE_LABELS } from '../constants/labels';
import { paymentMethodLabel, salesChannelLabel } from './v1-labels.util';

const HEADERS = [
  'Venta',
  'Cliente',
  'Tipo',
  'Canal',
  'Fecha',
  'Total',
  'Costo',
  'Comisiones',
  'Ganancia neta',
  'Medios de pago',
  'Factura',
  'Número de factura',
  'Fecha de factura',
];

function ymdToDisplay(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Filas de la planilla para el contador: una por venta, con total al final. */
export function buildAccountantSheetData(entries: SaleEntry[]): SheetData {
  const header = HEADERS.map((value) => ({
    value,
    fontWeight: 'bold' as const,
  }));
  const money = (value: number) => ({
    value: Math.round((Number(value) || 0) * 100) / 100,
    type: Number,
    format: '#,##0.00',
  });
  const rows: SheetData = [header];
  for (const entry of entries) {
    rows.push([
      { value: entry.saleId },
      { value: entry.customerName ?? '' },
      { value: SALE_SOURCE_LABELS[entry.source] ?? '' },
      { value: salesChannelLabel(entry.channel) },
      { value: ymdToDisplay(entry.soldAt) },
      money(entry.total),
      money(entry.cost),
      money(entry.fees),
      money(entry.netProfit),
      {
        value: (entry.paymentMethods ?? [])
          .map((method) => paymentMethodLabel(method))
          .join(', '),
      },
      { value: entry.invoice ? `Factura ${entry.invoice.type}` : 'Sin facturar' },
      { value: entry.invoice?.number ?? '' },
      { value: ymdToDisplay(entry.invoice?.issuedAt) },
    ]);
  }
  const sum = (pick: (entry: SaleEntry) => number) =>
    entries.reduce((acc, entry) => acc + (Number(pick(entry)) || 0), 0);
  const bold = (value: number) => ({ ...money(value), fontWeight: 'bold' as const });
  rows.push([
    { value: 'Total', fontWeight: 'bold' as const },
    null,
    null,
    null,
    null,
    bold(sum((e) => e.total)),
    bold(sum((e) => e.cost)),
    bold(sum((e) => e.fees)),
    bold(sum((e) => e.netProfit)),
  ]);
  return rows;
}

/** Descarga el .xlsx del mes (`monthKey`: YYYY-MM). */
export async function downloadAccountantExport(
  entries: SaleEntry[],
  monthKey: string,
): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  await writeXlsxFile(buildAccountantSheetData(entries), {
    columns: [
      { width: 16 },
      { width: 26 },
      { width: 12 },
      { width: 14 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 24 },
      { width: 14 },
      { width: 18 },
      { width: 16 },
    ],
  }).toFile(`ventas-${monthKey}-contador.xlsx`);
}
