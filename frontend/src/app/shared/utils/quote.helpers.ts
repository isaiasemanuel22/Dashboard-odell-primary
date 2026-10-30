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
