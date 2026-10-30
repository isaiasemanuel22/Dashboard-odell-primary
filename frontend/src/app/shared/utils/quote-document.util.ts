import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Customer,
  OrderItemPayload,
  Product,
  Quote,
  QuoteItem,
} from '../../core/models';
import { SERVICE_TYPE_LABELS } from '../constants/labels';
import {
  calculateLinePriceTotal,
  calculateOrderDiscount,
  calculateOrderSubtotal,
} from './order.helpers';
import { resolveMediaUrl } from './media-url.util';

const ACCENT = '#0089BF';
const PAGE_W = 794;
const PAGE_H = 1123;
const FIRST_PAGE_CAPACITY = 6;
const WHOLESALE_FACTOR = 0.8;
export const DEPOSIT_FACTOR = 0.5;
const LOGO_SRC = '/odell-logo-presupuesto.png';

export type QuoteDocumentFormat = 'pdf' | 'png';

export interface QuoteDocumentLine {
  productName: string;
  subtitle: string;
  measures: string;
  quantity: number;
  listPrice: number;
  wholesalePrice: number;
  subtotal: number;
  imageUrl: string | null;
}

export interface QuoteDocumentInput {
  numberLabel: string;
  dateLabel: string;
  customerName: string;
  customerTaxId: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  deliveryHint: string;
  lines: QuoteDocumentLine[];
  listSubtotal: number;
  wholesaleSubtotal: number;
  productCount: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR');
}

function quoteNumberLabel(id: string): string {
  const digits = id.replace(/\D+/g, '');
  return digits || id;
}

function lineListUnitPrice(item: QuoteItem | OrderItemPayload): number {
  const total = calculateLinePriceTotal(item);
  const qty = Math.max(Math.trunc(Number(item.quantity) || 0), 1);
  return total / qty;
}

function measuresForItem(
  item: QuoteItem | OrderItemPayload,
  product: Product | undefined,
): string {
  if (item.printWidthCm || item.printLengthCm) {
    const w = item.printWidthCm ?? 0;
    const l = item.printLengthCm ?? 0;
    return `${w} × ${l} cm`;
  }
  const size = product?.size?.trim();
  if (size) return size;
  return '—';
}

export function buildQuoteDocumentInput(
  quote: Quote,
  customer: Customer | null | undefined,
  productsById: Map<string, Product>,
): QuoteDocumentInput {
  const lines: QuoteDocumentLine[] = quote.items.map((item) => {
    const product = item.productId
      ? productsById.get(item.productId)
      : undefined;
    const listPrice = lineListUnitPrice(item);
    return {
      productName: item.productName || 'Sin nombre',
      subtitle: SERVICE_TYPE_LABELS[item.serviceType] ?? '',
      measures: measuresForItem(item, product),
      quantity: Math.max(Math.trunc(Number(item.quantity) || 0), 0),
      listPrice,
      wholesalePrice: listPrice * WHOLESALE_FACTOR,
      subtotal: calculateLinePriceTotal(item),
      imageUrl: resolveMediaUrl(product?.images?.[0] ?? null),
    };
  });

  const rawSubtotal = calculateOrderSubtotal(quote.items);
  const discount = calculateOrderDiscount(
    quote.items,
    quote.discountPercent,
    quote.discountAmount,
  );
  const listSubtotal = Math.max(rawSubtotal - discount, 0);

  return {
    numberLabel: quoteNumberLabel(quote.id),
    dateLabel: formatDate(quote.quotedAt || quote.createdAt),
    customerName: customer?.name || quote.customerName || '',
    customerTaxId: '',
    customerPhone: customer?.phone || '',
    customerEmail: customer?.email || '',
    customerAddress: '',
    deliveryHint: 'Retiro en taller · feria · envío',
    lines,
    listSubtotal,
    wholesaleSubtotal: listSubtotal * WHOLESALE_FACTOR,
    productCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

function productThumb(line: QuoteDocumentLine): string {
  if (!line.imageUrl) {
    return `<div style="width:60px;height:60px;flex-shrink:0;background:#EEF7FB;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)"></div>`;
  }
  return `<img src="${escapeHtml(line.imageUrl)}" alt="" crossorigin="anonymous" style="width:60px;height:60px;object-fit:cover;display:block;flex-shrink:0;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)">`;
}

function renderLineRow(line: QuoteDocumentLine, index: number): string {
  const bg = index % 2 === 0 ? '#ffffff' : '#F6FAFC';
  return `
<div style="display:grid;grid-template-columns:3fr 1.7fr 0.6fr 1fr 1.2fr 1fr;gap:10px;padding:12px 14px;font-size:14px;border-bottom:1px solid #C9DCE6;align-items:center;background:${bg}">
  <div style="display:flex;align-items:center;gap:14px;min-width:0">
    ${productThumb(line)}
    <div style="display:flex;flex-direction:column;gap:3px;min-width:0">
      <div style="font-weight:700;line-height:1.25">${escapeHtml(line.productName)}</div>
      ${line.subtitle ? `<div style="font-size:12px;color:#5A6B78">${escapeHtml(line.subtitle)}</div>` : ''}
    </div>
  </div>
  <div style="line-height:1.35">${escapeHtml(line.measures)}</div>
  <div style="text-align:right">${line.quantity}</div>
  <div style="text-align:right">${formatMoney(line.listPrice)}</div>
  <div style="text-align:right;color:#0A6E9C;font-weight:700">${formatMoney(line.wholesalePrice)}</div>
  <div style="text-align:right;font-weight:700">${formatMoney(line.subtotal)}</div>
</div>`;
}

function tableHeader(): string {
  return `
<div style="display:grid;grid-template-columns:3fr 1.7fr 0.6fr 1fr 1.2fr 1fr;gap:10px;background:#12263A;color:#ffffff;padding:10px 14px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">
  <div>Producto</div>
  <div>Medidas</div>
  <div style="text-align:right">Cant.</div>
  <div style="text-align:right">Lista</div>
  <div style="text-align:right">Mayorista</div>
  <div style="text-align:right">Subtotal</div>
</div>`;
}

function pageShell(opts: {
  body: string;
  header: string;
  footerRight: string;
}): string {
  return `
<div class="odell-quote-page" style="width:${PAGE_W}px;height:${PAGE_H}px;box-sizing:border-box;background:#ffffff;font-family:'DM Sans','Helvetica Neue',Arial,sans-serif;color:#12263A;display:flex;flex-direction:column;position:relative;overflow:hidden">
  ${opts.header}
  ${opts.body}
  <div style="background:#12263A;color:#E6F6FD;padding:14px 48px;display:flex;justify-content:space-between;align-items:center;font-size:12px">
    <div>Taller: Brasil 1265, Mar del Plata · Lun a vie 11 a 18 hs · Feria Plaza España sáb y dom</div>
    <div style="display:flex;gap:16px"><div style="font-weight:700">odellstore.mitiendanube.com</div><div>${escapeHtml(opts.footerRight)}</div></div>
  </div>
</div>`;
}

function page1Header(doc: QuoteDocumentInput): string {
  return `
<div style="position:relative;height:210px;background:${ACCENT};clip-path:polygon(0 0,100% 0,100% 78%,62% 100%,0 86%);display:flex;align-items:flex-start;justify-content:space-between;padding:40px 48px 0 48px;box-sizing:border-box">
  <div style="display:flex;align-items:center;gap:18px">
    <div style="width:92px;height:112px;background:#ffffff;clip-path:polygon(50% 0,100% 22%,100% 78%,50% 100%,0 78%,0 22%);display:flex;align-items:center;justify-content:center">
      <img src="${LOGO_SRC}" alt="Logo de Odell" style="width:58px;height:auto;display:block">
    </div>
    <div style="display:flex;flex-direction:column;gap:4px">
      <div style="font-family:Outfit,'DM Sans',sans-serif;font-weight:700;font-size:44px;letter-spacing:6px;color:#ffffff;line-height:1">ODELL</div>
      <div style="font-size:14px;letter-spacing:1.5px;color:#E6F6FD;text-transform:uppercase">Impresión 3D y estampados</div>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;color:#ffffff">
    <div style="font-family:Outfit,'DM Sans',sans-serif;font-weight:600;font-size:30px;letter-spacing:3px;line-height:1">PRESUPUESTO</div>
    <div style="font-size:14px;color:#E6F6FD">N.º ${escapeHtml(doc.numberLabel)}</div>
    <div style="font-size:14px;color:#E6F6FD">Fecha: ${escapeHtml(doc.dateLabel)}</div>
    <div style="font-size:14px;color:#E6F6FD">Válido por 15 días</div>
  </div>
</div>`;
}

function page2Header(doc: QuoteDocumentInput): string {
  return `
<div style="background:${ACCENT};padding:18px 48px;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box">
  <div style="display:flex;align-items:center;gap:14px">
    <div style="width:44px;height:56px;background:#ffffff;clip-path:polygon(50% 0,100% 22%,100% 78%,50% 100%,0 78%,0 22%);display:flex;align-items:center;justify-content:center">
      <img src="${LOGO_SRC}" alt="Logo de Odell" style="width:28px;height:auto;display:block">
    </div>
    <div style="font-family:Outfit,'DM Sans',sans-serif;font-weight:700;font-size:26px;letter-spacing:5px;color:#ffffff;line-height:1">ODELL</div>
  </div>
  <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;color:#ffffff">
    <div style="font-family:Outfit,'DM Sans',sans-serif;font-weight:600;font-size:18px;letter-spacing:3px;line-height:1">PRESUPUESTO N.º ${escapeHtml(doc.numberLabel)}</div>
    <div style="font-size:13px;color:#E6F6FD">Productos (continuación), totales y condiciones</div>
  </div>
</div>`;
}

function customerBlock(doc: QuoteDocumentInput): string {
  return `
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px">
  <div style="display:flex;flex-direction:column;gap:10px">
    <div style="font-family:Outfit,sans-serif;font-weight:600;font-size:13px;letter-spacing:2px;color:#0A6E9C;text-transform:uppercase">Cliente</div>
    <div style="font-size:14px;border-bottom:1px solid #C9DCE6;padding-bottom:5px">Nombre: ${escapeHtml(doc.customerName)}</div>
    <div style="font-size:14px;border-bottom:1px solid #C9DCE6;padding-bottom:5px">CUIT / DNI: ${escapeHtml(doc.customerTaxId)}</div>
    <div style="font-size:14px;border-bottom:1px solid #C9DCE6;padding-bottom:5px">Teléfono: ${escapeHtml(doc.customerPhone)}</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div style="font-family:Outfit,sans-serif;font-weight:600;font-size:13px;letter-spacing:2px;color:#0A6E9C;text-transform:uppercase">Entrega</div>
    <div style="font-size:14px;border-bottom:1px solid #C9DCE6;padding-bottom:5px">Email: ${escapeHtml(doc.customerEmail)}</div>
    <div style="font-size:14px;border-bottom:1px solid #C9DCE6;padding-bottom:5px">Domicilio: ${escapeHtml(doc.customerAddress)}</div>
    <div style="font-size:14px;border-bottom:1px solid #C9DCE6;padding-bottom:5px">${escapeHtml(doc.deliveryHint)}</div>
  </div>
</div>`;
}

function totalsBlock(doc: QuoteDocumentInput): string {
  const depositList = doc.listSubtotal * DEPOSIT_FACTOR;
  const balanceList = doc.listSubtotal - depositList;
  const depositWholesale = doc.wholesaleSubtotal * DEPOSIT_FACTOR;
  const balanceWholesale = doc.wholesaleSubtotal - depositWholesale;
  const countLabel = `${doc.productCount} producto${doc.productCount === 1 ? '' : 's'}`;

  return `
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px">
  <div style="display:flex;flex-direction:column">
    <div style="font-family:Outfit,sans-serif;font-weight:600;font-size:13px;letter-spacing:2px;color:#0A6E9C;text-transform:uppercase;padding-bottom:6px">Precio de lista</div>
    <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid #C9DCE6"><div>Subtotal (${countLabel})</div><div>${formatMoney(doc.listSubtotal)}</div></div>
    <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid #C9DCE6"><div>Seña (50%)</div><div>${formatMoney(depositList)}</div></div>
    <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid #C9DCE6"><div>Saldo antes del despacho</div><div>${formatMoney(balanceList)}</div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;background:${ACCENT};color:#ffffff;padding:12px 16px;margin-top:10px;clip-path:polygon(14px 0,100% 0,100% 100%,0 100%,0 14px)">
      <div style="font-family:Outfit,sans-serif;font-weight:600;font-size:15px;letter-spacing:2px">TOTAL</div>
      <div style="font-family:Outfit,sans-serif;font-weight:700;font-size:24px">${formatMoney(doc.listSubtotal)}</div>
    </div>
  </div>
  <div style="display:flex;flex-direction:column">
    <div style="font-family:Outfit,sans-serif;font-weight:600;font-size:13px;letter-spacing:2px;color:#0A6E9C;text-transform:uppercase;padding-bottom:6px">Precio mayorista (20% menos)</div>
    <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid #C9DCE6"><div>Subtotal (${countLabel})</div><div>${formatMoney(doc.wholesaleSubtotal)}</div></div>
    <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid #C9DCE6"><div>Seña (50%)</div><div>${formatMoney(depositWholesale)}</div></div>
    <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;border-bottom:1px solid #C9DCE6"><div>Saldo antes del despacho</div><div>${formatMoney(balanceWholesale)}</div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;border:2px solid ${ACCENT};color:#0A6E9C;padding:10px 16px;margin-top:10px">
      <div style="font-family:Outfit,sans-serif;font-weight:600;font-size:15px;letter-spacing:2px">TOTAL MAYORISTA</div>
      <div style="font-family:Outfit,sans-serif;font-weight:700;font-size:24px">${formatMoney(doc.wholesaleSubtotal)}</div>
    </div>
  </div>
</div>`;
}

function conditionsBlock(): string {
  return `
<div style="background:#EEF7FB;padding:18px 22px;display:flex;flex-direction:column;gap:10px">
  <div style="font-family:Outfit,sans-serif;font-weight:600;font-size:13px;letter-spacing:2px;color:#0A6E9C;text-transform:uppercase">Condiciones</div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 28px;font-size:12px;line-height:1.5;color:#33475A">
    <div><b style="color:#12263A">Pago:</b> seña del 50% para confirmar; el saldo se abona al terminar, antes del despacho.</div>
    <div><b style="color:#12263A">Validez:</b> este presupuesto se mantiene 15 días desde su emisión.</div>
    <div><b style="color:#12263A">Plazos:</b> en días hábiles. La producción arranca al confirmar el pedido.</div>
    <div><b style="color:#12263A">Envíos:</b> Correo Argentino o Andreani, a cargo del cliente y no incluidos en el total.</div>
    <div><b style="color:#12263A">Retiro:</b> en el taller (Brasil 1265) o en la feria de Plaza España.</div>
    <div><b style="color:#12263A">Garantía:</b> según el producto, hasta 1 mes. No cubre mal uso ni roturas en el envío.</div>
    <div><b style="color:#12263A">Factura:</b> se emite Factura C (monotributo).</div>
  </div>
</div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px;margin-top:8px">
  <div style="display:flex;flex-direction:column;gap:28px">
    <div style="font-size:13px;color:#5A6B78">Firma y aclaración del cliente</div>
    <div style="border-bottom:1px solid #C9DCE6;height:36px"></div>
  </div>
  <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-end;gap:4px">
    <div style="font-weight:700">Isaías · Odell</div>
  </div>
</div>`;
}

function buildPages(doc: QuoteDocumentInput): string[] {
  const first = doc.lines.slice(0, FIRST_PAGE_CAPACITY);
  const rest = doc.lines.slice(FIRST_PAGE_CAPACITY);

  if (rest.length === 0) {
    const body = `
<div style="padding:20px 48px 24px 48px;display:flex;flex-direction:column;gap:26px;flex-grow:1">
  ${customerBlock(doc)}
  <div style="display:flex;flex-direction:column;gap:10px">
    <div style="font-family:Outfit,sans-serif;font-weight:600;font-size:13px;letter-spacing:2px;color:#0A6E9C;text-transform:uppercase">Productos</div>
    <div style="display:flex;flex-direction:column">
      ${tableHeader()}
      ${first.map((line, i) => renderLineRow(line, i)).join('')}
    </div>
  </div>
  <div style="margin-top:auto;display:flex;flex-direction:column;gap:22px">
    ${totalsBlock(doc)}
    ${conditionsBlock()}
  </div>
</div>`;
    return [
      pageShell({
        header: page1Header(doc),
        body,
        footerRight: '1/1',
      }),
    ];
  }

  const page1Body = `
<div style="padding:20px 48px 24px 48px;display:flex;flex-direction:column;gap:26px;flex-grow:1">
  ${customerBlock(doc)}
  <div style="display:flex;flex-direction:column;gap:10px">
    <div style="font-family:Outfit,sans-serif;font-weight:600;font-size:13px;letter-spacing:2px;color:#0A6E9C;text-transform:uppercase">Productos</div>
    <div style="display:flex;flex-direction:column">
      ${tableHeader()}
      ${first.map((line, i) => renderLineRow(line, i)).join('')}
    </div>
  </div>
  <div style="margin-top:auto;font-size:12px;color:#5A6B78;text-align:right">Continúa en la página 2</div>
</div>`;

  const page2Body = `
<div style="padding:18px 48px 22px 48px;display:flex;flex-direction:column;gap:22px;flex-grow:1">
  <div style="display:flex;flex-direction:column">
    ${tableHeader()}
    ${rest.map((line, i) => renderLineRow(line, i)).join('')}
  </div>
  ${totalsBlock(doc)}
  ${conditionsBlock()}
</div>`;

  return [
    pageShell({
      header: page1Header(doc),
      body: page1Body,
      footerRight: '1/2',
    }),
    pageShell({
      header: page2Header(doc),
      body: page2Body,
      footerRight: '2/2',
    }),
  ];
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

async function renderPagesToCanvases(
  pagesHtml: string[],
): Promise<HTMLCanvasElement[]> {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;pointer-events:none;';
  document.body.appendChild(host);

  try {
    const canvases: HTMLCanvasElement[] = [];
    for (const html of pagesHtml) {
      const wrap = document.createElement('div');
      wrap.innerHTML = html;
      const page = wrap.firstElementChild as HTMLElement;
      host.appendChild(page);
      await waitForImages(page);
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: PAGE_W,
        height: PAGE_H,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H,
      });
      canvases.push(canvas);
      host.removeChild(page);
    }
    return canvases;
  } finally {
    host.remove();
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen'));
    }, 'image/png');
  });
}

async function downloadPdf(
  canvases: HTMLCanvasElement[],
  filename: string,
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < canvases.length; i++) {
    if (i > 0) pdf.addPage();
    const dataUrl = canvases[i].toDataURL('image/jpeg', 0.92);
    pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, pageHeight);
  }
  pdf.save(filename);
}

async function downloadPng(
  canvases: HTMLCanvasElement[],
  filename: string,
): Promise<void> {
  if (canvases.length === 1) {
    downloadBlob(await canvasToBlob(canvases[0]), filename);
    return;
  }

  const gap = 24;
  const width = Math.max(...canvases.map((c) => c.width));
  const height =
    canvases.reduce((sum, c) => sum + c.height, 0) +
    gap * (canvases.length - 1);
  const merged = document.createElement('canvas');
  merged.width = width;
  merged.height = height;
  const ctx = merged.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el canvas');
  ctx.fillStyle = '#F5F4EF';
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  for (const canvas of canvases) {
    ctx.drawImage(canvas, 0, y);
    y += canvas.height + gap;
  }
  downloadBlob(await canvasToBlob(merged), filename);
}

export async function exportQuoteDocument(
  doc: QuoteDocumentInput,
  format: QuoteDocumentFormat,
): Promise<void> {
  const pages = buildPages(doc);
  const canvases = await renderPagesToCanvases(pages);
  const base = `presupuesto-${doc.numberLabel || 'odell'}`;
  if (format === 'pdf') {
    await downloadPdf(canvases, `${base}.pdf`);
  } else {
    await downloadPng(canvases, `${base}.png`);
  }
}
