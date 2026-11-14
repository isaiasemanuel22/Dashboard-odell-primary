import { Quote } from '../../core/models';
import { formatCurrencyArs } from './currency-ars.util';
import { quoteValidUntilYmd } from './quote-validity.util';

/** Dígitos para wa.me con prefijo país AR; vacío si no hay teléfono usable. */
export function whatsAppDigitsAr(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('54')) return digits;
  if (digits.startsWith('0')) return `54${digits.slice(1)}`;
  return `54${digits}`;
}

function validUntilLabel(quotedAt: string): string {
  const [year, month, day] = quoteValidUntilYmd(quotedAt).split('-');
  return `${Number(day)}/${Number(month)}/${year}`;
}

/** Resumen para WhatsApp / compartir. No hay link público del presupuesto en la app. */
export function buildQuoteShareText(quote: Quote): string {
  const customer = quote.customerId ? quote.customerName?.trim() : '';
  const lines = [
    customer ? `Hola ${customer}!` : 'Hola!',
    `Te paso el presupuesto ${quote.id} de Odell.`,
    `Total: ${formatCurrencyArs(Number(quote.total) || 0)}`,
    `Válido hasta el ${validUntilLabel(quote.quotedAt)}.`,
  ];
  return lines.join('\n');
}

export function quoteWhatsAppUrl(
  quote: Quote,
  phone?: string | null,
): string {
  const digits = whatsAppDigitsAr(phone);
  const text = encodeURIComponent(buildQuoteShareText(quote));
  return `https://wa.me/${digits}?text=${text}`;
}
