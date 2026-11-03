import type { jsPDF } from 'jspdf';
import {
  Product,
  ProfitArea,
  SaleEntry,
  SalesStats,
} from '../../core/models';
import { SERVICE_TYPE_LABELS } from '../constants/labels';
import { formatCurrencyArs } from './currency-ars.util';
import {
  allocateSaleEntryItemEconomics,
  listProfitAreas,
  resolveProfitArea,
} from './profit-area.util';

function formatCurrency(value: number): string {
  return formatCurrencyArs(Math.round(value));
}

export interface SalesReportProductRow {
  productName: string;
  quantity: number;
  cost: number;
  profit: number;
  total: number;
}

export interface SalesReportAreaSection {
  area: ProfitArea;
  areaLabel: string;
  rows: SalesReportProductRow[];
}

type AutoTableFn = typeof import('jspdf-autotable').default;


function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

function normalizeProductKey(name: string): string {
  return name.trim().toLowerCase();
}

export function buildSalesReportAreaSections(
  entries: SaleEntry[],
  resolveProduct: (productId: string) => Pick<Product, 'type'> | null,
): SalesReportAreaSection[] {
  const grouped = new Map<
    ProfitArea,
    Map<string, SalesReportProductRow & { key: string }>
  >();

  for (const entry of entries) {
    for (const item of entry.items) {
      const product = item.productId ? resolveProduct(item.productId) : null;
      const area = resolveProfitArea(product, item.serviceType);
      if (!area) continue;

      const economics = allocateSaleEntryItemEconomics(entry, item);
      const key = normalizeProductKey(item.productName);
      const byProduct =
        grouped.get(area) ??
        new Map<string, SalesReportProductRow & { key: string }>();

      const existing = byProduct.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.cost += economics.cost;
        existing.profit += economics.profit;
        existing.total += economics.total;
      } else {
        byProduct.set(key, {
          key,
          productName: item.productName.trim(),
          quantity: item.quantity,
          cost: economics.cost,
          profit: economics.profit,
          total: economics.total,
        });
      }

      grouped.set(area, byProduct);
    }
  }

  return listProfitAreas()
    .map((area) => {
      const rows = [...(grouped.get(area)?.values() ?? [])]
        .sort((a, b) => a.productName.localeCompare(b.productName, 'es'))
        .map(({ productName, quantity, cost, profit, total }) => ({
          productName,
          quantity,
          cost,
          profit,
          total,
        }));

      return {
        area,
        areaLabel: SERVICE_TYPE_LABELS[area],
        rows,
      };
    })
    .filter((section) => section.rows.length > 0);
}

function appendAreaBalanceSection(
  doc: jsPDF,
  autoTable: AutoTableFn,
  stats: SalesStats,
  startY: number,
): number {
  autoTable(doc, {
    startY,
    head: [['Área', 'Vendido', 'Costos', 'Ganancia', 'Ventas', 'Pedidos']],
    body: (stats.profitByArea ?? []).map((balance) => [
      SERVICE_TYPE_LABELS[balance.area],
      formatCurrency(balance.revenue),
      formatCurrency(balance.cost),
      formatCurrency(balance.profit),
      formatCurrency(balance.retail.profit),
      formatCurrency(balance.orders.profit),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 95] },
    theme: 'grid',
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
}

function appendProductSections(
  doc: jsPDF,
  autoTable: AutoTableFn,
  sections: SalesReportAreaSection[],
  startY: number,
): void {
  let y = startY + 8;

  for (const section of sections) {
    if (y > 250) {
      doc.addPage();
      y = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${section.areaLabel}:`, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Cantidad', 'Costo', 'Ganancia', 'Total']],
      body: section.rows.map((row) => [
        row.productName,
        formatQuantity(row.quantity),
        formatCurrency(row.cost),
        formatCurrency(row.profit),
        formatCurrency(row.total),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
      theme: 'striped',
      margin: { left: 14, right: 14 },
    });

    y =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
  }
}

export async function downloadSalesReportPdf(
  stats: SalesStats,
  entries: SaleEntry[],
  products: Product[],
  monthLabel = currentMonthLabel(),
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const resolveProduct = (productId: string) =>
    products.find((product) => product.id === productId) ?? null;
  const sections = buildSalesReportAreaSections(entries, resolveProduct);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Reporte de ventas', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), 14, 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Balance del mes', 14, 36);

  autoTable(doc, {
    startY: 40,
    head: [['Concepto', 'Monto']],
    body: [
      ['Vendido del mes', formatCurrency(stats.monthlyRevenue)],
      ['Costos del mes', formatCurrency(stats.monthlyCost)],
      ['Ganancias del mes', formatCurrency(stats.monthlyProfit)],
      [
        `Vendido en pedidos (${stats.monthlyOrdersCount} pedido(s))`,
        formatCurrency(stats.monthlyOrdersRevenue),
      ],
      [
        `Vendido en mostrador (${stats.monthlyRetailCount} venta(s))`,
        formatCurrency(stats.monthlyRetailRevenue),
      ],
      ['Ganancias de pedidos', formatCurrency(stats.monthlyOrdersProfit)],
      ['Ganancias de ventas', formatCurrency(stats.monthlyRetailProfit)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 95] },
    theme: 'grid',
  });

  let y =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Balance por área', 14, y);
  y += 4;

  y = appendAreaBalanceSection(doc, autoTable, stats, y) + 10;

  if (y > 240) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Detalle por área y producto', 14, y);

  appendProductSections(doc, autoTable, sections, y);

  doc.save(`reporte-ventas-${currentMonthFileSuffix()}.pdf`);
}
