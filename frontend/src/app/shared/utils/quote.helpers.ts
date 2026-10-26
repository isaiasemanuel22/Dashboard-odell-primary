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
