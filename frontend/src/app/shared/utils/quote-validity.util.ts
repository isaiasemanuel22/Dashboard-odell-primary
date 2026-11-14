import { QuoteStatus } from '../../core/models';

/** Días de validez desde la emisión (misma regla que el PDF y el backend). */
export const QUOTE_VALIDITY_DAYS = 15;

const AR_TZ = 'America/Argentina/Buenos_Aires';

function arYmd(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Último día válido (YYYY-MM-DD): emisión + 15 días. */
export function quoteValidUntilYmd(quotedAt: string | Date): string {
  const base = new Date(quotedAt);
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + QUOTE_VALIDITY_DAYS,
    ),
  )
    .toISOString()
    .slice(0, 10);
}

/** «Vencido» se deriva: solo Borrador/Enviado con la validez ya pasada (día AR). */
export function isQuoteExpired(
  quote: { status: QuoteStatus; quotedAt?: string | Date | null },
  now: Date = new Date(),
): boolean {
  if (
    quote.status !== QuoteStatus.BORRADOR &&
    quote.status !== QuoteStatus.ENVIADO
  ) {
    return false;
  }
  if (!quote.quotedAt || Number.isNaN(new Date(quote.quotedAt).getTime())) {
    return false;
  }
  return arYmd(now) > quoteValidUntilYmd(quote.quotedAt);
}

export const QUOTE_EXPIRED_LABEL = 'Vencido';
