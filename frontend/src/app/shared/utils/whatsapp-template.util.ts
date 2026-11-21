import { Order, Quote, WhatsAppTemplate } from '../../core/models';
import { formatCurrencyArs } from './currency-ars.util';
import { formatDateDayMonth } from './date-format.util';
import { orderBalanceAmount, orderPaidAmount } from './order.helpers';
import { whatsAppDigitsAr } from './quote-share.util';

export const WHATSAPP_TEMPLATE_VARIABLES = [
  'cliente',
  'pedido',
  'items',
  'total',
  'pagado',
  'saldo',
  'entrega',
] as const;

export type WhatsAppTemplateVariable =
  (typeof WHATSAPP_TEMPLATE_VARIABLES)[number];

export type WhatsAppTemplateVars = Record<WhatsAppTemplateVariable, string>;

/** Ids fijos de las plantillas de fábrica. */
export const WA_TEMPLATE_QUOTE = 'tpl-presupuesto';
export const WA_TEMPLATE_READY = 'tpl-listo';
export const WA_TEMPLATE_BALANCE = 'tpl-saldo';

/**
 * Reemplaza `{variable}` por su valor. Una variable desconocida se deja tal cual;
 * una vacía se saca y se acomodan los espacios sueltos que deja.
 */
export function renderWhatsAppTemplate(
  body: string,
  vars: Partial<WhatsAppTemplateVars>,
): string {
  const known = new Set<string>(WHATSAPP_TEMPLATE_VARIABLES);
  return (body ?? '')
    .replace(/\{(\w+)\}/g, (match, key: string) =>
      known.has(key) ? (vars[key as WhatsAppTemplateVariable] ?? '') : match,
    )
    .replace(/[ \t]+([!,.:;?])/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

export function buildOrderTemplateVars(
  order: Pick<
    Order,
    'id' | 'customerId' | 'customerName' | 'items' | 'total' | 'payments' | 'dueDate'
  >,
  customerName?: string | null,
): WhatsAppTemplateVars {
  const name = customerName ?? (order.customerId ? order.customerName : '');
  return {
    cliente: firstName(name),
    pedido: order.id,
    items: (order.items ?? [])
      .map((item) => `${item.quantity} × ${item.productName}`)
      .join('\n'),
    total: formatCurrencyArs(Number(order.total) || 0),
    pagado: formatCurrencyArs(orderPaidAmount(order)),
    saldo: formatCurrencyArs(orderBalanceAmount(order)),
    entrega: order.dueDate ? formatDateDayMonth(order.dueDate) : '',
  };
}

export function buildQuoteTemplateVars(
  quote: Pick<Quote, 'id' | 'customerId' | 'customerName' | 'items' | 'total'>,
): WhatsAppTemplateVars {
  return {
    cliente: firstName(quote.customerId ? quote.customerName : ''),
    pedido: quote.id,
    items: (quote.items ?? [])
      .map((item) => `${item.quantity} × ${item.productName}`)
      .join('\n'),
    total: formatCurrencyArs(Number(quote.total) || 0),
    pagado: '',
    saldo: '',
    entrega: '',
  };
}

/** Plantilla por defecto de un pedido según su estado y saldo. */
export function defaultOrderTemplateId(
  order: Pick<Order, 'status' | 'total' | 'payments'>,
  templates: WhatsAppTemplate[],
): string | null {
  const has = (id: string) => templates.some((tpl) => tpl.id === id);
  if (order.status === 'terminado' && has(WA_TEMPLATE_READY)) {
    return WA_TEMPLATE_READY;
  }
  if (orderBalanceAmount(order) > 0 && has(WA_TEMPLATE_BALANCE)) {
    return WA_TEMPLATE_BALANCE;
  }
  return templates[0]?.id ?? null;
}

export function whatsAppMessageUrl(
  phone: string | null | undefined,
  message: string,
): string {
  const digits = whatsAppDigitsAr(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
