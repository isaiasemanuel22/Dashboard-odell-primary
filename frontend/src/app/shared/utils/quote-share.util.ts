import { Quote } from '../../core/models';
import { formatCurrencyArs } from './currency-ars.util';
import { quoteValidUntilYmd } from './quote-validity.util';

/**
 * Dígitos para wa.me de un celular argentino: 549 + área sin 0 + número sin 15.
 * Acepta «0223 15 677-3255», «+54 9 223 677-3255», «223 677 3255», etc.
 * Vacío si no hay teléfono usable.
 */
export function whatsAppDigitsAr(phone: string | null | undefined): string {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('54')) {
    digits = digits.slice(2);
    if (digits.startsWith('9') && digits.length === 11) digits = digits.slice(1);
  }
  digits = digits.replace(/^0+/, '');
  if (!digits) return '';
  if (digits.length === 12) {
    // Área de 2 a 4 dígitos + «15» + número: se saca el 15.
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === '15') {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }
  return `549${digits}`;
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
