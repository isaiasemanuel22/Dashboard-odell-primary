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

const MONTHS_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** Último día válido como partes numéricas (misma fuente: quoteValidUntilYmd). */
export function quoteValidUntilParts(quotedAt?: string | Date | null): {
  day: number;
  month: number;
  year: number;
} {
  const [year, month, day] = quoteValidUntilYmd(quotedAt ?? new Date())
    .split('-')
    .map(Number);
  return { day, month, year };
}

/** «Válido hasta el 15 de nov de 2026». */
export function quoteValidUntilLong(quotedAt?: string | Date | null): string {
  const { day, month, year } = quoteValidUntilParts(quotedAt);
  return `Válido hasta el ${day} de ${MONTHS_SHORT[month - 1]} de ${year}`;
}

/** «Válido hasta 15/11/2026». */
export function quoteValidUntilNumeric(quotedAt?: string | Date | null): string {
  const { day, month, year } = quoteValidUntilParts(quotedAt);
  return `Válido hasta ${day}/${month}/${year}`;
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
