import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Product,
  ProfitArea,
  SaleEntry,
  SaleEntryItem,
  SalesStats,
} from '../../core/models';
import { SERVICE_TYPE_LABELS } from '../constants/labels';
import {
  allocateSaleEntryItemEconomics,
  listProfitAreas,
  resolveProfitArea,
} from './profit-area.util';

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

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

function appendAreaBalanceSection(doc: jsPDF, stats: SalesStats, startY: number): number {
  autoTable(doc, {
    startY,
    head: [['Área', 'Ingresos', 'Costos', 'Ganancia', 'Ventas', 'Pedidos']],
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

export function downloadSalesReportPdf(
  stats: SalesStats,
  entries: SaleEntry[],
  products: Product[],
  monthLabel = currentMonthLabel(),
): void {
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
      ['Ingresos del mes', formatCurrency(stats.monthlyRevenue)],
      ['Costos del mes', formatCurrency(stats.monthlyCost)],
      ['Ganancias del mes', formatCurrency(stats.monthlyProfit)],
      [
        `Ingresos de pedidos (${stats.monthlyOrdersCount} pedido(s))`,
        formatCurrency(stats.monthlyOrdersRevenue),
      ],
      [
        `Ingresos de ventas (${stats.monthlyRetailCount} venta(s))`,
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

  y = appendAreaBalanceSection(doc, stats, y) + 10;

  if (y > 240) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Detalle por área y producto', 14, y);

  appendProductSections(doc, sections, y);

  doc.save(`reporte-ventas-${currentMonthFileSuffix()}.pdf`);
}
