import {
  Customer,
  OrderItemPayload,
  PriceType,
  Product,
  Quote,
  QuoteItem,
  ServiceType,
  WholesaleDiscountSettings,
} from '../../core/models';
import { serviceTypeLabel } from '../constants/labels';
import {
  calculateLinePriceTotal,
  calculateOrderDiscount,
  calculateOrderSubtotal,
} from './order.helpers';
import {
  wholesaleAppliesToService,
} from './order-wholesale-preview.util';
import {
  normalizeWholesaleDiscount,
  wholesalePriceFromList,
} from './wholesale-example.util';
import { STORE_QR_PATH } from './quote-document-qr';

const PAGE_W = 794;
const PAGE_H = 1123;
export const DEPOSIT_FACTOR = 0.5;
const VALIDITY_DAYS = 15;
const LOGO_SRC = '/odell-logo-presupuesto.png';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap';

export type QuoteDocumentFormat = 'pdf' | 'png';

/**
 * Diseño del documento: `lista` y `mayorista` siguen el tipo de precio del
 * presupuesto; `comparativo` muestra los dos precios y está siempre disponible.
 */
export type QuoteDocumentVariant = 'lista' | 'mayorista' | 'comparativo';

export interface QuoteDocumentLine {
  productName: string;
  serviceType: ServiceType;
  subtitle: string;
  measures: string;
  quantity: number;
  listPrice: number;
  wholesalePrice: number;
  /** Subtotal de la línea a precio de lista. */
  listLineTotal: number;
  /** Subtotal de la línea a precio mayorista. */
  subtotal: number;
  /** Si el mayorista le baja el precio (si no, es precio cerrado). */
  discounted: boolean;
}

export interface QuoteDocumentInput {
  numberLabel: string;
  dateLabel: string;
  validUntilLabel: string;
  customerName: string;
  customerTaxId: string;
  customerPhone: string;
  customerEmail: string;
  lines: QuoteDocumentLine[];
  /** Sumas de las líneas antes del descuento del presupuesto. */
  listGross: number;
  wholesaleGross: number;
  /** Totales con el descuento del presupuesto aplicado. */
  listSubtotal: number;
  wholesaleSubtotal: number;
  /** % de descuento mayorista de Ajustes (para el rótulo del documento). */
  wholesalePercent: number;
  /** Compra mínima mayorista del cliente (0 = no se muestra). */
  wholesaleMinimum: number;
  productCount: number;
}

/** El presupuesto se cotizó a mayorista y el descuento quedó aplicado. */
export function isWholesaleQuote(quote: Quote): boolean {
  return quote.priceType === PriceType.MAYORISTA && !!quote.wholesaleApplied;
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

function formatDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function quoteNumberLabel(id: string): string {
  const digits = id.replace(/\D+/g, '');
  return digits || id;
}

/** Precio de lista del ítem: listUnitPrice si existe; si no, el unitario guardado. */
function documentListUnitPrice(item: QuoteItem | OrderItemPayload): number {
  // `null` llega de la API para líneas sin mayorista: Number(null) daría 0.
  if (item.listUnitPrice != null) {
    const fromList = Number(item.listUnitPrice);
    if (Number.isFinite(fromList) && fromList >= 0) {
      return fromList;
    }
  }
  const total = calculateLinePriceTotal(item);
  const qty = Math.max(Math.trunc(Number(item.quantity) || 0), 1);
  return total / qty;
}

function documentWholesaleUnitPrice(
  listPrice: number,
  serviceType: QuoteItem['serviceType'],
  settings: WholesaleDiscountSettings,
): number {
  if (!wholesaleAppliesToService(serviceType, settings)) {
    return listPrice;
  }
  return wholesalePriceFromList(listPrice, settings.percent);
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
  return product?.size?.trim() ?? '';
}

export function buildQuoteDocumentInput(
  quote: Quote,
  customer: Customer | null | undefined,
  productsById: Map<string, Product>,
  wholesaleDiscount?: WholesaleDiscountSettings | null,
): QuoteDocumentInput {
  const settings = normalizeWholesaleDiscount(wholesaleDiscount ?? null);

  const lines: QuoteDocumentLine[] = quote.items.map((item) => {
    const product = item.productId
      ? productsById.get(item.productId)
      : undefined;
    const listPrice = documentListUnitPrice(item);
    // Si la línea ya quedó cotizada a mayorista, se muestra ese precio (§16.2).
    const wholesalePrice =
      item.listUnitPrice != null
        ? Number(item.unitPrice) || 0
        : documentWholesaleUnitPrice(listPrice, item.serviceType, settings);
    const quantity = Math.max(Math.trunc(Number(item.quantity) || 0), 0);
    return {
      productName: item.productName || 'Sin nombre',
      serviceType: item.serviceType,
      subtitle: serviceTypeLabel(item.serviceType),
      measures: measuresForItem(item, product),
      quantity,
      listPrice,
      wholesalePrice,
      listLineTotal: Math.round(listPrice * quantity),
      subtotal: Math.round(wholesalePrice * quantity),
      discounted: Math.round(wholesalePrice) < Math.round(listPrice),
    };
  });

  const listGross = lines.reduce((sum, line) => sum + line.listLineTotal, 0);
  const wholesaleGross = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const chargedGross = calculateOrderSubtotal(quote.items);
  const discount = calculateOrderDiscount(
    quote.items,
    quote.discountPercent,
    quote.discountAmount,
  );
  const netFactor =
    chargedGross > 0 ? Math.max(chargedGross - discount, 0) / chargedGross : 1;

  const quotedAt = new Date(quote.quotedAt || quote.createdAt);
  const validUntil = new Date(quotedAt);
  validUntil.setDate(validUntil.getDate() + VALIDITY_DAYS);

  return {
    numberLabel: quoteNumberLabel(quote.id),
    dateLabel: formatDate(quotedAt),
    validUntilLabel: formatDate(validUntil),
    customerName: customer?.name || quote.customerName || '',
    customerTaxId: customer?.taxId || '',
    customerPhone: customer?.phone || '',
    customerEmail: customer?.email || '',
    lines,
    listGross,
    wholesaleGross,
    listSubtotal: Math.round(listGross * netFactor),
    wholesaleSubtotal: Math.round(wholesaleGross * netFactor),
    wholesalePercent: settings.percent,
    wholesaleMinimum: Math.max(Number(customer?.wholesaleMinimum) || 0, 0),
    productCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

/* ── Documento (artboards «PDF · Presupuestos» del lienzo) ─────────────── */

const PAGE_CSS = `
.odell-quote-page{width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;font-family:Ubuntu,"Segoe UI",Arial,sans-serif;color:#0F2A3A;display:flex;flex-direction:column;box-sizing:border-box;position:relative;overflow:hidden;font-size:11.5px;line-height:1.35}
.odell-quote-page *{box-sizing:border-box}
.odell-quote-page .hd{background:#0B7FB4;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:22px 40px 20px;gap:20px}
.odell-quote-page .hd.sm{padding:14px 40px}
.odell-quote-page .brand{display:flex;align-items:center;gap:16px}
.odell-quote-page .logo{width:74px;height:84px;background:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.odell-quote-page .logo img{width:56px;height:auto;display:block}
.odell-quote-page .hd.sm .logo{width:40px;height:46px;border-radius:8px}
.odell-quote-page .hd.sm .logo img{width:30px}
.odell-quote-page .bn{font-size:34px;font-weight:700;letter-spacing:.14em;line-height:1}
.odell-quote-page .hd.sm .bn{font-size:22px}
.odell-quote-page .bs{font-size:10.5px;letter-spacing:.12em;margin-top:6px;opacity:.95}
.odell-quote-page .dt{text-align:right}
.odell-quote-page .dt h1{margin:0;font-size:26px;letter-spacing:.14em;font-weight:700;line-height:1.2}
.odell-quote-page .hd.sm .dt h1{font-size:17px}
.odell-quote-page .dt .tag{display:inline-block;margin-top:6px;background:#fff;color:#0B5F86;border-radius:999px;padding:3px 10px;font-size:10px;font-weight:700;letter-spacing:.06em}
.odell-quote-page .dt .meta{margin-top:8px;font-size:11px;opacity:.95;line-height:1.5}
.odell-quote-page .hd.sm .dt .meta{margin-top:4px}
.odell-quote-page .strip{display:flex;justify-content:space-between;gap:12px;padding:8px 40px;background:#0F2A3A;color:#DCE8F0;font-size:10.5px}
.odell-quote-page .strip b{color:#fff;font-weight:700}
.odell-quote-page .body{padding:16px 40px 0;display:flex;flex-direction:column;gap:12px;flex:1;min-height:0}
.odell-quote-page .h{font-size:10px;font-weight:700;letter-spacing:.14em;color:#0B5F86;margin:0 0 6px}
.odell-quote-page .cards{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.odell-quote-page .cardx{border:1px solid #D6E3EC;border-radius:10px;padding:10px 14px}
.odell-quote-page .kv{display:grid;grid-template-columns:78px 1fr;gap:3px 10px;font-size:11.5px}
.odell-quote-page .kv span:nth-child(odd){color:#5B7083}
.odell-quote-page .blank{border-bottom:1px dotted #9FB3C2;min-height:14px}
.odell-quote-page table{width:100%;border-collapse:collapse;font-size:inherit}
.odell-quote-page th{background:#0F2A3A;color:#fff;font-size:9.5px;letter-spacing:.1em;font-weight:700;text-align:left;padding:8px 10px}
.odell-quote-page td{padding:9px 10px;border-bottom:1px solid #E3ECF2;vertical-align:top}
.odell-quote-page .r{text-align:right}
.odell-quote-page .c{text-align:center}
.odell-quote-page .pn{font-weight:700;font-size:12px}
.odell-quote-page .ps{display:block;color:#5B7083;font-size:10.5px;margin-top:2px}
.odell-quote-page .area{display:inline-block;font-size:9px;font-weight:700;border-radius:999px;padding:1px 7px;margin-right:4px;border:1px solid}
.odell-quote-page .strike{text-decoration:line-through;color:#7A8C9A}
.odell-quote-page .blue{color:#0B5F86;font-weight:700}
.odell-quote-page .nod{display:inline-block;font-size:9px;color:#5B7083;background:#EEF3F7;border-radius:999px;padding:1px 7px;margin-top:3px}
.odell-quote-page .tot{border:1px solid #D6E3EC;border-radius:10px;overflow:hidden}
.odell-quote-page .trow{display:flex;justify-content:space-between;gap:10px;padding:6px 14px;font-size:11.5px}
.odell-quote-page .trow+.trow{border-top:1px solid #EEF3F7}
.odell-quote-page .trow>:last-child{white-space:nowrap;flex:none}
.odell-quote-page .tbig{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#0B7FB4;color:#fff}
.odell-quote-page .tbig .l{font-size:11px;font-weight:700;letter-spacing:.14em}
.odell-quote-page .tbig .v{font-size:24px;font-weight:700}
.odell-quote-page .tbig.out{background:#fff;color:#0B5F86;border-top:2px solid #0B7FB4}
.odell-quote-page .save{display:inline-block;background:#DCFCE7;color:#166534;font-weight:700;border-radius:999px;padding:2px 9px;font-size:10.5px}
.odell-quote-page .pay{display:grid;grid-template-columns:1fr 1fr 150px;gap:14px;align-items:stretch}
.odell-quote-page .box{background:#F1F7FB;border-radius:10px;padding:10px 14px}
.odell-quote-page .box.line{background:#fff;border:1px solid #D6E3EC}
.odell-quote-page .alias{font-size:15px;font-weight:700;color:#0B5F86;letter-spacing:.02em}
.odell-quote-page .qrb{border:1px solid #D6E3EC;border-radius:10px;padding:8px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}
.odell-quote-page .qrb img{width:96px;height:96px;display:block}
.odell-quote-page .cond{display:grid;grid-template-columns:1fr;gap:3px;font-size:10px;color:#33495A}
.odell-quote-page .cond p{margin:0}
.odell-quote-page .cond b{color:#0F2A3A}
.odell-quote-page .sign{display:flex;justify-content:space-between;align-items:flex-end;gap:30px;margin-top:auto;padding:4px 0 14px}
.odell-quote-page .sl{flex:1;border-top:1px solid #9FB3C2;padding-top:4px;font-size:10px;color:#5B7083}
.odell-quote-page .ft{background:#0F2A3A;color:#B7C9D6;font-size:9.5px;display:flex;justify-content:space-between;padding:7px 40px}
.odell-quote-page .note{font-size:10px;color:#5B7083}
.odell-quote-page .more{margin-top:auto;padding-bottom:14px;text-align:right}
`;

/** Colores del chip de área (mismos que los chips de la app). */
const AREA_COLORS: Record<ServiceType, [string, string, string]> = {
  [ServiceType.IMPRESION_3D]: ['#1D4ED8', '#BFDBFE', '#EFF6FF'],
  [ServiceType.DISENO_GRAFICO]: ['#7E22CE', '#D7BDF5', '#F8F2FF'],
  [ServiceType.MODELADO]: ['#0F766E', '#99D6CE', '#F0FDFA'],
  [ServiceType.ESTAMPADO]: ['#C2410C', '#F7C3A1', '#FFF5EE'],
  [ServiceType.INSUMO]: ['#475569', '#CBD5E1', '#F1F5F9'],
  [ServiceType.SERVICIO_TERCERO]: ['#475569', '#CBD5E1', '#F1F5F9'],
};

let qrSrc: string | null = null;

/** QR como PNG: html2canvas no dibuja bien un SVG sin tamaño propio. */
function storeQrSrc(): string {
  if (qrSrc) return qrSrc;
  const modules = 33;
  const scale = 8;
  const canvas = document.createElement('canvas');
  canvas.width = modules * scale;
  canvas.height = modules * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#0F2A3A';
  ctx.fill(new Path2D(STORE_QR_PATH));
  qrSrc = canvas.toDataURL('image/png');
  return qrSrc;
}

const VARIANT_TAG: Record<QuoteDocumentVariant, string> = {
  lista: '',
  mayorista: 'MAYORISTA · REVENDEDOR',
  comparativo: 'LISTA VS. POR MAYOR',
};

function areaChip(line: QuoteDocumentLine): string {
  const [color, border, bg] = AREA_COLORS[line.serviceType];
  return `<span class="area" style="color:${color};border-color:${border};background:${bg}">${escapeHtml(line.subtitle)}</span>`;
}

function detailCell(line: QuoteDocumentLine, closedNote = ''): string {
  return `<td><span class="pn">${escapeHtml(line.productName)}</span><span class="ps">${areaChip(line)}${escapeHtml(line.measures)}</span>${closedNote}</td>`;
}

function tableHead(variant: QuoteDocumentVariant): string {
  if (variant === 'lista') {
    return `<tr><th>DETALLE</th><th class="c" style="width:60px">CANT.</th><th class="r" style="width:110px">PRECIO U.</th><th class="r" style="width:120px">SUBTOTAL</th></tr>`;
  }
  if (variant === 'mayorista') {
    return `<tr><th>DETALLE</th><th class="c" style="width:52px">CANT.</th><th class="r" style="width:90px">LISTA U.</th><th class="r" style="width:100px">MAYORISTA U.</th><th class="r" style="width:105px">SUBTOTAL</th></tr>`;
  }
  return `<tr><th>DETALLE</th><th class="c" style="width:44px">CANT.</th><th class="r" style="width:76px">LISTA U.</th><th class="r" style="width:84px">MAYOR U.</th><th class="r" style="width:90px">SUBT. LISTA</th><th class="r" style="width:96px">SUBT. MAYOR</th></tr>`;
}

function tableRow(line: QuoteDocumentLine, variant: QuoteDocumentVariant): string {
  if (variant === 'lista') {
    return `<tr>${detailCell(line)}<td class="c">${line.quantity}</td><td class="r">${formatMoney(line.listPrice)}</td><td class="r"><b>${formatMoney(line.listLineTotal)}</b></td></tr>`;
  }
  if (variant === 'mayorista') {
    const closed = line.discounted
      ? ''
      : '<span class="nod">Precio cerrado · sin descuento</span>';
    const list = line.discounted
      ? `<span class="strike">${formatMoney(line.listPrice)}</span>`
      : formatMoney(line.listPrice);
    return `<tr>${detailCell(line, closed)}<td class="c">${line.quantity}</td><td class="r">${list}</td><td class="r${line.discounted ? ' blue' : ''}">${formatMoney(line.wholesalePrice)}</td><td class="r"><b>${formatMoney(line.subtotal)}</b></td></tr>`;
  }
  const closed = line.discounted ? '' : '<span class="nod">Sin descuento</span>';
  return `<tr>${detailCell(line, closed)}<td class="c">${line.quantity}</td><td class="r">${formatMoney(line.listPrice)}</td><td class="r${line.discounted ? ' blue' : ''}">${formatMoney(line.wholesalePrice)}</td><td class="r">${formatMoney(line.listLineTotal)}</td><td class="r"><b class="blue">${formatMoney(line.subtotal)}</b></td></tr>`;
}

function productsTable(
  lines: QuoteDocumentLine[],
  variant: QuoteDocumentVariant,
  title: string,
): string {
  if (lines.length === 0) return '';
  const suffix =
    variant === 'mayorista'
      ? ' · PRECIO MAYORISTA'
      : variant === 'comparativo'
        ? ' · COMPARATIVA'
        : '';
  return `<div><p class="h">${title}${suffix}</p><table><thead>${tableHead(variant)}</thead><tbody>${lines.map((line) => tableRow(line, variant)).join('')}</tbody></table></div>`;
}

function mainHeader(doc: QuoteDocumentInput, variant: QuoteDocumentVariant): string {
  const tag = VARIANT_TAG[variant];
  return `
<div class="hd">
  <div class="brand"><div class="logo"><img src="${LOGO_SRC}" alt="Logo de Odell"></div><div><div class="bn">ODELL</div><div class="bs">IMPRESIÓN 3D · MODELADO · DISEÑO · ESTAMPADO</div></div></div>
  <div class="dt"><h1>PRESUPUESTO</h1>${tag ? `<div><span class="tag">${tag}</span></div>` : ''}<div class="meta">N.º ${escapeHtml(doc.numberLabel)}<br>Fecha: ${escapeHtml(doc.dateLabel)}<br>Válido hasta: ${escapeHtml(doc.validUntilLabel)}</div></div>
</div>
<div class="strip"><span>WhatsApp <b>223 677-3255</b></span><span>Instagram <b>@Odell_print3D</b></span><span>Tienda <b>odellstore.mitiendanube.com</b></span><span>Brasil 1265 · Mar del Plata</span></div>`;
}

function continuationHeader(doc: QuoteDocumentInput): string {
  return `
<div class="hd sm">
  <div class="brand"><div class="logo"><img src="${LOGO_SRC}" alt="Logo de Odell"></div><div class="bn">ODELL</div></div>
  <div class="dt"><h1>PRESUPUESTO N.º ${escapeHtml(doc.numberLabel)}</h1><div class="meta">Continuación</div></div>
</div>`;
}

function kvValue(value: string): string {
  return value ? `<span>${escapeHtml(value)}</span>` : '<span class="blank"></span>';
}

function partyCards(doc: QuoteDocumentInput): string {
  return `
<div class="cards">
  <div class="cardx"><p class="h">CLIENTE</p><div class="kv"><span>Nombre</span>${kvValue(doc.customerName)}<span>Teléfono</span>${kvValue(doc.customerPhone)}<span>Email</span>${kvValue(doc.customerEmail)}<span>CUIT / DNI</span>${kvValue(doc.customerTaxId)}</div></div>
  <div class="cardx"><p class="h">ENTREGA</p><div class="kv"><span>Modalidad</span><span>Retiro en taller · feria · envío</span><span>Domicilio</span><span class="blank"></span><span>Plazo</span><span>7 días hábiles desde la seña</span><span>Envío</span><span>A cargo del cliente, no incluido</span></div></div>
</div>`;
}

function deposit(total: number): number {
  return Math.round(total * DEPOSIT_FACTOR);
}

function minimumSentence(doc: QuoteDocumentInput): string {
  return doc.wholesaleMinimum > 0
    ? ` Compra mínima mayorista: ${formatMoney(doc.wholesaleMinimum)}.`
    : '';
}

function quoteDiscountRow(gross: number, net: number): string {
  const amount = gross - net;
  return amount > 0
    ? `<div class="trow"><span>Descuento</span><span style="color:#B91C1C">−${formatMoney(amount)}</span></div>`
    : '';
}

function totalsSection(doc: QuoteDocumentInput, variant: QuoteDocumentVariant): string {
  if (variant === 'lista') {
    const units = `${doc.productCount} unidad${doc.productCount === 1 ? '' : 'es'}`;
    return `
<div style="display:grid;grid-template-columns:1fr 300px;gap:14px;align-items:start">
  <div class="note" style="padding-top:4px">Precios en pesos argentinos. El diseño se cobra aunque después no se avance con la producción.</div>
  <div class="tot"><div class="trow"><span>Subtotal (${units})</span><span>${formatMoney(doc.listGross)}</span></div>${quoteDiscountRow(doc.listGross, doc.listSubtotal)}<div class="trow"><span>Envío</span><span>No incluido</span></div><div class="tbig"><span class="l">TOTAL</span><span class="v">${formatMoney(doc.listSubtotal)}</span></div></div>
</div>`;
  }

  const hasClosed = doc.lines.some((line) => !line.discounted);
  if (variant === 'mayorista') {
    const wholesaleOff = doc.listGross - doc.wholesaleGross;
    return `
<div style="display:grid;grid-template-columns:1fr 300px;gap:14px;align-items:start">
  <div class="note" style="padding-top:4px;line-height:1.5">Precio para revendedores: <b style="color:#0F2A3A">${doc.wholesalePercent}% menos sobre el precio de lista</b> de cada producto.${hasClosed ? ' Los ítems sin descuento tienen precio cerrado.' : ''}${minimumSentence(doc)}</div>
  <div class="tot"><div class="trow"><span>Subtotal a precio de lista</span><span>${formatMoney(doc.listGross)}</span></div><div class="trow"><span>Descuento mayorista (−${doc.wholesalePercent}% en productos)</span><span style="color:#B91C1C">−${formatMoney(wholesaleOff)}</span></div>${quoteDiscountRow(doc.wholesaleGross, doc.wholesaleSubtotal)}<div class="tbig"><span class="l">TOTAL MAYORISTA</span><span class="v">${formatMoney(doc.wholesaleSubtotal)}</span></div></div>
</div>`;
  }

  const saving = doc.listSubtotal - doc.wholesaleSubtotal;
  const savingPct =
    doc.listSubtotal > 0 ? Math.round((saving / doc.listSubtotal) * 100) : 0;
  const box = (total: number) => {
    const dep = deposit(total);
    return `<div class="trow"><span>Seña ${Math.round(DEPOSIT_FACTOR * 100)}%</span><span>${formatMoney(dep)}</span></div><div class="trow"><span>Saldo antes del despacho</span><span>${formatMoney(total - dep)}</span></div>`;
  };
  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
  <div class="tot"><div class="trow" style="background:#F7FAFC"><b>PRECIO DE LISTA</b><span class="note">Venta minorista</span></div><div class="trow"><span>Subtotal</span><span>${formatMoney(doc.listSubtotal)}</span></div>${box(doc.listSubtotal)}<div class="tbig out"><span class="l">TOTAL</span><span class="v">${formatMoney(doc.listSubtotal)}</span></div></div>
  <div class="tot" style="border-color:#0B7FB4"><div class="trow" style="background:#E8F4FA"><b style="color:#0B5F86">PRECIO POR MAYOR</b>${saving > 0 ? `<span class="save">Ahorrás ${formatMoney(saving)} · ${savingPct}%</span>` : ''}</div><div class="trow"><span>Subtotal (−${doc.wholesalePercent}% en productos)</span><span>${formatMoney(doc.wholesaleSubtotal)}</span></div>${box(doc.wholesaleSubtotal)}<div class="tbig"><span class="l">TOTAL</span><span class="v">${formatMoney(doc.wholesaleSubtotal)}</span></div></div>
</div>
<div class="note" style="margin-top:-6px">El precio por mayor es para revendedores.${minimumSentence(doc)} El descuento se aplica sobre el precio de cada producto${hasClosed ? '; los ítems sin descuento tienen precio cerrado' : ''}.</div>`;
}

function paymentSection(doc: QuoteDocumentInput, variant: QuoteDocumentVariant): string {
  let depositLabel: string;
  let balanceLabel: string;
  if (variant === 'comparativo') {
    const depList = deposit(doc.listSubtotal);
    const depWholesale = deposit(doc.wholesaleSubtotal);
    depositLabel = `${formatMoney(depList)} o ${formatMoney(depWholesale)}`;
    balanceLabel = `${formatMoney(doc.listSubtotal - depList)} o ${formatMoney(doc.wholesaleSubtotal - depWholesale)}`;
  } else {
    const total = variant === 'mayorista' ? doc.wholesaleSubtotal : doc.listSubtotal;
    const dep = deposit(total);
    depositLabel = formatMoney(dep);
    balanceLabel = formatMoney(total - dep);
  }
  return `
<div class="pay">
  <div class="box"><p class="h">DATOS DE PAGO</p><div class="alias">Odell.27.mp</div><div class="note" style="margin-top:2px">Mercado Pago · Titular: Lorena Zalazar</div><div style="margin-top:6px;font-size:11px">Seña para confirmar: <b>${depositLabel}</b><br>Saldo antes del despacho: <b>${balanceLabel}</b></div></div>
  <div class="box line"><p class="h">CÓMO SEGUIMOS</p><div style="font-size:10.5px;line-height:1.55">1. Transferí la seña al alias.<br>2. Mandá el comprobante por WhatsApp al <b>223 677-3255</b>.<br>3. Te enviamos el diseño para aprobar.<br>4. Producimos y te avisamos para el saldo.</div></div>
  <div class="qrb"><img src="${storeQrSrc()}" alt="Código QR a la tienda online"><b style="font-size:10.5px">Mirá el catálogo</b><span class="note" style="font-size:9px">Escaneá para ir a la tienda online</span></div>
</div>`;
}

function closingSection(): string {
  return `
<div><p class="h">CONDICIONES</p><div class="cond">
  <p><b>Pago:</b> seña del 50% para confirmar; el saldo se abona al terminar, antes del despacho.</p>
  <p><b>Diseño:</b> se abona antes de empezar e incluye 2 rondas de cambios.</p>
  <p><b>Validez:</b> 15 días desde la emisión. Plazos en días hábiles.</p>
  <p><b>Factura:</b> se emite Factura C (monotributo) a pedido.</p>
  <p><b>Retiro:</b> taller (Brasil 1265, lun a vie 11 a 18 h) o feria de Plaza España.</p>
  <p><b>Envíos:</b> Correo Argentino o Andreani, a cargo del cliente.</p>
  <p><b>Garantía:</b> según el producto, hasta 1 mes. No cubre mal uso ni roturas en el envío.</p>
  <p><b>Colores:</b> pueden variar levemente respecto de la pantalla.</p>
</div></div>
<div class="sign"><div class="sl">Firma y aclaración del cliente</div><div class="sl" style="text-align:right;color:#0F2A3A"><b>Isaías · Odell</b><br><span style="color:#5B7083">Impresión 3D y estampados</span></div></div>`;
}

function pageShell(
  doc: QuoteDocumentInput,
  header: string,
  body: string,
  pageNumber: number,
  pageCount: number,
): string {
  return `
<div class="odell-quote-page">
  <style>${PAGE_CSS}</style>
  ${header}
  <div class="body">${body}</div>
  <div class="ft"><span>Odell · Impresión 3D y estampados · Mar del Plata</span><span>Presupuesto ${escapeHtml(doc.numberLabel)} · Página ${pageNumber} de ${pageCount}</span></div>
</div>`;
}

interface PagePlan {
  lines: QuoteDocumentLine[];
  first: boolean;
  last: boolean;
}

function renderPage(
  doc: QuoteDocumentInput,
  variant: QuoteDocumentVariant,
  plan: PagePlan,
  pageNumber: number,
  pageCount: number,
): string {
  const title = plan.first
    ? 'PRODUCTOS Y SERVICIOS'
    : 'PRODUCTOS Y SERVICIOS (CONTINUACIÓN)';
  const body = [
    plan.first ? partyCards(doc) : '',
    productsTable(plan.lines, variant, title),
    plan.last
      ? totalsSection(doc, variant) +
        paymentSection(doc, variant) +
        closingSection()
      : `<div class="note more">Continúa en la página ${pageNumber + 1}</div>`,
  ].join('');
  return pageShell(
    doc,
    plan.first ? mainHeader(doc, variant) : continuationHeader(doc),
    body,
    pageNumber,
    pageCount,
  );
}

function htmlToElement(html: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  return wrap.firstElementChild as HTMLElement;
}

function createOffscreenHost(): HTMLElement {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;pointer-events:none;';
  document.body.appendChild(host);
  return host;
}

/**
 * Reparte las filas midiendo cada hoja: la primera lleva cliente y entrega,
 * la última totales, pago y condiciones; las filas cambian de alto según los chips.
 */
function buildPages(
  doc: QuoteDocumentInput,
  variant: QuoteDocumentVariant,
): string[] {
  const host = createOffscreenHost();
  const fits = (plan: PagePlan, pageNumber: number): boolean => {
    const page = htmlToElement(renderPage(doc, variant, plan, pageNumber, 1));
    host.appendChild(page);
    const body = page.querySelector<HTMLElement>('.body');
    const ok = !body || body.scrollHeight <= body.clientHeight + 1;
    host.removeChild(page);
    return ok;
  };

  const plans: PagePlan[] = [];
  try {
    let rest = doc.lines;
    for (;;) {
      const first = plans.length === 0;
      const pageNumber = plans.length + 1;
      const last: PagePlan = { lines: rest, first, last: true };
      if (rest.length === 0 || fits(last, pageNumber)) {
        plans.push(last);
        break;
      }
      let count = rest.length;
      while (
        count > 1 &&
        !fits({ lines: rest.slice(0, count), first, last: false }, pageNumber)
      ) {
        count--;
      }
      // Que la hoja de totales no quede sin ninguna fila.
      if (count === rest.length && count > 1) count--;
      plans.push({ lines: rest.slice(0, count), first, last: false });
      rest = rest.slice(count);
    }
  } finally {
    host.remove();
  }

  return plans.map((plan, index) =>
    renderPage(doc, variant, plan, index + 1, plans.length),
  );
}

/** El documento usa Ubuntu (como el diseño); la app no la carga por defecto. */
async function ensureDocumentFont(): Promise<void> {
  if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
    await new Promise<void>((resolve) => {
      link.onload = () => resolve();
      link.onerror = () => resolve();
    });
  }
  try {
    await Promise.all(
      ['400', '500', '700'].map((weight) =>
        document.fonts.load(`${weight} 12px Ubuntu`),
      ),
    );
  } catch {
    // Sin la fuente se usa el respaldo (Segoe UI / Arial).
  }
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
  const { default: html2canvas } = await import('html2canvas');
  const host = createOffscreenHost();

  try {
    const canvases: HTMLCanvasElement[] = [];
    for (const html of pagesHtml) {
      const page = htmlToElement(html);
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
  const { jsPDF } = await import('jspdf');
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
  variant: QuoteDocumentVariant,
  format: QuoteDocumentFormat,
): Promise<void> {
  await ensureDocumentFont();
  const pages = buildPages(doc, variant);
  const canvases = await renderPagesToCanvases(pages);
  const suffix = variant === 'comparativo' ? '-comparativo' : '';
  const base = `presupuesto-${doc.numberLabel || 'odell'}${suffix}`;
  if (format === 'pdf') {
    await downloadPdf(canvases, `${base}.pdf`);
  } else {
    await downloadPng(canvases, `${base}.png`);
  }
}
