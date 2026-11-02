import { Quote, QuoteItem, QuoteStatus, ServiceType } from '../../core/models';
import { ListFilterOption } from '../../components/db-list-toolbar/db-list-toolbar.component';
import { QUOTE_STATUS_LABELS, SERVICE_TYPE_LABELS } from '../constants/labels';
import { labelsToSelectOptions } from './select-options';
import { lineFromOrderItem } from './order.helpers';

export type QuoteStatusFilter = QuoteStatus | 'all' | 'activos';

export function quoteStatusFilters(): ListFilterOption<QuoteStatusFilter>[] {
  return [
    { value: 'activos', label: 'Activos' },
    { value: 'all', label: 'Todos' },
    ...labelsToSelectOptions(QUOTE_STATUS_LABELS),
  ];
}

export function matchesQuoteStatusFilter(
  status: QuoteStatus,
  filter: QuoteStatusFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'activos') {
    return (
      status === QuoteStatus.BORRADOR || status === QuoteStatus.ENVIADO
    );
  }
  return status === filter;
}

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

/** Chip de la lista mobile: Abiertos (= activos) + cada QuoteStatus. */
export type QuoteMobileChip = 'abiertos' | QuoteStatus;

export function quoteMobileChips(): { value: QuoteMobileChip; label: string }[] {
  return [
    { value: 'abiertos', label: 'Abiertos' },
    ...Object.values(QuoteStatus).map((status) => ({
      value: status,
      label: QUOTE_STATUS_LABELS[status],
    })),
  ];
}

export function matchesQuoteMobileChip(
  status: QuoteStatus,
  chip: QuoteMobileChip,
): boolean {
  if (chip === 'abiertos') {
    return matchesQuoteStatusFilter(status, 'activos');
  }
  return status === chip;
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
  if (!quote.customerId) {
    return 'Falta cliente para enviarlo';
  }

  const validity = formatQuoteMobileValidityShort(quote.quotedAt);
  if (quote.status === QuoteStatus.ENVIADO) {
    const days = daysSince(quote.quotedAt);
    if (days == null) return validity;
    if (days <= 0) return `${validity} · enviado hoy`;
    if (days === 1) return `${validity} · enviado hace 1 día`;
    return `${validity} · enviado hace ${days} días`;
  }
  return validity;
}

export function quoteLinesMetaLabel(quote: Quote): string {
  const lines = quote.items.length;
  const noun = lines === 1 ? 'línea' : 'líneas';
  return `${quote.id} · ${lines} ${noun}`;
}

/** Clase de pill de estado (m-pill + variante). */
export function quoteStatusPillClass(status: QuoteStatus): string {
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

/** Ganancia estimada: total − Σ(unitCost × qty). */
export function quoteEstimatedProfit(quote: Quote): number {
  const cost = quote.items.reduce((sum, item) => {
    const unit = Number(item.unitCost) || 0;
    const qty = Number(item.quantity) || 0;
    return sum + unit * qty;
  }, 0);
  return Math.round(quote.total - cost);
}

function daysSince(iso: string | Date | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const ms = Date.now() - then.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
