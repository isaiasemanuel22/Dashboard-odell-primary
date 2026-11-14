import { Quote, QuoteItem, QuoteStatus, ServiceType } from '../../core/models';
import { ListFilterOption } from '../../components/db-list-toolbar/db-list-toolbar.component';
import { QUOTE_STATUS_LABELS, SERVICE_TYPE_LABELS } from '../constants/labels';
import { labelsToSelectOptions } from './select-options';
import { lineFromOrderItem } from './order.helpers';
import { isThirdPartyService } from './service-type.util';
import {
  QUOTE_EXPIRED_LABEL,
  isQuoteExpired,
  quoteValidUntilYmd,
} from './quote-validity.util';

type QuoteStateInput = Pick<Quote, 'status' | 'quotedAt'>;

export type QuoteStatusFilter =
  | QuoteStatus
  | 'all'
  | 'activos'
  | 'vencidos';

export function quoteStatusFilters(): ListFilterOption<QuoteStatusFilter>[] {
  return [
    { value: 'activos', label: 'Abiertos' },
    { value: 'vencidos', label: QUOTE_EXPIRED_LABEL + 's' },
    ...labelsToSelectOptions(QUOTE_STATUS_LABELS),
    { value: 'all', label: 'Todos' },
  ];
}

/**
 * Los vencidos (Borrador/Enviado con validez pasada) solo aparecen en
 * «Vencidos» y «Todos»: no cuentan como abiertos ni en su estado guardado.
 */
export function matchesQuoteStatusFilter(
  quote: QuoteStateInput,
  filter: QuoteStatusFilter,
): boolean {
  if (filter === 'all') return true;
  const expired = isQuoteExpired(quote);
  if (filter === 'vencidos') return expired;
  if (expired) return false;
  if (filter === 'activos') {
    return (
      quote.status === QuoteStatus.BORRADOR ||
      quote.status === QuoteStatus.ENVIADO
    );
  }
  return quote.status === filter;
}

/** Etiqueta de estado visible: «Vencido» pisa Borrador/Enviado. */
export function quoteStatusLabelFor(quote: QuoteStateInput): string {
  return isQuoteExpired(quote)
    ? QUOTE_EXPIRED_LABEL
    : (QUOTE_STATUS_LABELS[quote.status] ?? quote.status);
}

/** Aceptar solo con validez vigente. */
export function canAcceptQuote(quote: QuoteStateInput): boolean {
  return isQuoteEditable(quote.status) && !isQuoteExpired(quote);
}

export const QUOTE_EXPIRED_HINT =
  'Presupuesto vencido: renovalo para extender la validez antes de aceptarlo.';

export function isQuoteEditable(status: QuoteStatus): boolean {
  return (
    status === QuoteStatus.BORRADOR || status === QuoteStatus.ENVIADO
  );
}

export function canGenerateOrderFromQuote(status: QuoteStatus): boolean {
  return status === QuoteStatus.ACEPTADO;
}

export function lineFromQuoteItem(item: QuoteItem) {
  return lineFromOrderItem(item);
}

export function quoteServiceFilters(): ListFilterOption<ServiceType | 'all'>[] {
  return [
    { value: 'all', label: 'Todas' },
    ...labelsToSelectOptions(SERVICE_TYPE_LABELS),
  ];
}

export function quoteIncludesService(quote: Quote, service: ServiceType): boolean {
  return quote.services.includes(service);
}

/** Filtros de la hoja mobile de Presupuestos (área = servicio). */
export type QuoteMobileServiceFilter = ServiceType | 'all';

export interface QuoteMobileSheetFilters {
  service: QuoteMobileServiceFilter;
}

export function emptyQuoteMobileSheetFilters(): QuoteMobileSheetFilters {
  return { service: 'all' };
}

export function countQuoteMobileSheetFilters(
  filters: QuoteMobileSheetFilters,
): number {
  return filters.service === 'all' ? 0 : 1;
}

export function matchesQuoteMobileSheetFilters(
  quote: Quote,
  filters: QuoteMobileSheetFilters,
): boolean {
  if (filters.service === 'all') return true;
  return quoteIncludesService(quote, filters.service);
}

/** Validez del presupuesto: quotedAt + 15 días (misma regla que el formulario). */
export function formatQuoteValidityLabel(quotedAt?: string | Date | null): string {
  const base = new Date(quotedAt ?? Date.now());
  const validUntil = new Date(base);
  validUntil.setDate(validUntil.getDate() + 15);
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  return `Válido hasta el ${validUntil.getDate()} de ${months[validUntil.getMonth()]} de ${validUntil.getFullYear()}`;
}

/** Chip de la lista mobile: Abiertos, Vencidos, cada QuoteStatus y Todos. */
export type QuoteMobileChip = 'abiertos' | 'vencidos' | 'todos' | QuoteStatus;

export function quoteMobileChips(): { value: QuoteMobileChip; label: string }[] {
  return [
    { value: 'abiertos', label: 'Abiertos' },
    { value: 'vencidos', label: QUOTE_EXPIRED_LABEL + 's' },
    ...Object.values(QuoteStatus).map((status) => ({
      value: status as QuoteMobileChip,
      label: QUOTE_STATUS_LABELS[status],
    })),
    { value: 'todos', label: 'Todos' },
  ];
}

export function matchesQuoteMobileChip(
  quote: QuoteStateInput,
  chip: QuoteMobileChip,
): boolean {
  if (chip === 'abiertos') return matchesQuoteStatusFilter(quote, 'activos');
  if (chip === 'vencidos') return matchesQuoteStatusFilter(quote, 'vencidos');
  if (chip === 'todos') return true;
  return matchesQuoteStatusFilter(quote, chip);
}

/** «Válido hasta 15/11» (corto, para tarjetas). */
export function formatQuoteMobileValidityShort(
  quotedAt?: string | Date | null,
): string {
  const base = new Date(quotedAt ?? Date.now());
  const validUntil = new Date(base);
  validUntil.setDate(validUntil.getDate() + 15);
  return `Válido hasta ${validUntil.getDate()}/${validUntil.getMonth() + 1}`;
}

/** Línea de contexto de la tarjeta mobile. */
export function formatQuoteMobileContextHint(quote: Quote): string {
  if (quote.orderId) {
    return `Pedido ${quote.orderId} generado`;
  }
  if (!quote.customerId && quote.status === QuoteStatus.BORRADOR) {
    return 'Falta cliente para enviarlo';
  }

  const validity = formatQuoteMobileValidityShort(quote.quotedAt);
  if (isQuoteExpired(quote)) return `Venció el ${validityShortDate(quote.quotedAt)}`;
  if (isEmptyQuote(quote)) return 'Vacío · sin líneas';
  if (quote.status === QuoteStatus.ENVIADO) {
    const days = daysSince(quote.quotedAt);
    if (days == null) return validity;
    if (days <= 0) return `${validity} · enviado hoy`;
    if (days === 1) return `${validity} · enviado hace 1 día`;
    return `${validity} · enviado hace ${days} días`;
  }
  return validity;
}

function validityShortDate(quotedAt: string | Date): string {
  const [, month, day] = quoteValidUntilYmd(quotedAt).split('-').map(Number);
  return `${day}/${month}`;
}

/** Borrador sin líneas ni total (datos de prueba o creados a medias). */
export function isEmptyQuote(quote: Pick<Quote, 'items' | 'total' | 'status'>): boolean {
  return (
    quote.status === QuoteStatus.BORRADOR &&
    !(quote.items?.length > 0) &&
    !(Number(quote.total) > 0)
  );
}

export function quoteLinesMetaLabel(quote: Quote): string {
  const lines = quote.items.length;
  const noun = lines === 1 ? 'línea' : 'líneas';
  return `${quote.id} · ${lines} ${noun}`;
}

/** Clase de pill de estado (m-pill + variante). */
export function quoteStatusPillClass(
  status: QuoteStatus,
  expired = false,
): string {
  if (expired) return 'm-pill m-pill--d';
  switch (status) {
    case QuoteStatus.ACEPTADO:
      return 'm-pill m-pill--ok';
    case QuoteStatus.RECHAZADO:
    case QuoteStatus.CANCELADO:
      return 'm-pill m-pill--d';
    case QuoteStatus.ENVIADO:
      return 'm-pill m-pill--b';
    case QuoteStatus.BORRADOR:
    default:
      return 'm-pill';
  }
}

/** Ganancia estimada: total − costo. El servicio de un tercero no suma ganancia. */
export function quoteEstimatedProfit(quote: Quote): number {
  const cost = quote.items.reduce((sum, item) => {
    if (isThirdPartyService(item.serviceType)) return sum;
    const unit = Number(item.unitCost) || 0;
    const qty = Number(item.quantity) || 0;
    return sum + unit * qty;
  }, 0);
  const linesTotal = quote.items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    return sum + (Number(item.unitPrice) || 0) * qty;
  }, 0);
  const thirdParty = quote.items.reduce((sum, item) => {
    if (!isThirdPartyService(item.serviceType)) return sum;
    const qty = Number(item.quantity) || 0;
    return sum + (Number(item.unitPrice) || 0) * qty;
  }, 0);
  const chargedThird =
    linesTotal > 0 ? Math.round(thirdParty * (quote.total / linesTotal)) : 0;
  return Math.round(quote.total - cost - chargedThird);
}

function daysSince(iso: string | Date | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const ms = Date.now() - then.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
