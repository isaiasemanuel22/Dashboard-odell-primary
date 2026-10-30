import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Quote, ServiceType } from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { QuotesService } from '../../core/services/quotes.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { removeById, upsertById } from '../../core/utils/replace-in-store';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import {
  DB_DATA_TABLE,
  DbButtonComponent,
  OdlActionEvent,
  OdlColumn,
  OdlFilter,
  OdlRowAction,
  QuoteCardComponent,
  quoteStatusBadge,
  serviceTag,
} from '@general-components';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  clearCreateQuery,
  shouldOpenCreateFromQuery,
} from '../../shared/utils/create-from-query.util';
import {
  matchesQuoteStatusFilter,
  quoteIncludesService,
  quoteServiceFilters,
  quoteStatusFilters,
} from '../../shared/utils/quote.helpers';

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [
    DbButtonComponent,
    QuoteCardComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './quotes.component.html',
  styleUrl: './quotes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotesComponent implements OnInit {
  private readonly quotesService = inject(QuotesService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  quotes: Quote[] = [];
  loading = true;

  readonly searchText = (quote: Quote) =>
    [quote.id, quote.customerName, ...quote.items.map((item) => item.productName)].join(' ');

  readonly statusFilters: OdlFilter<Quote>[] = quoteStatusFilters().map((filter) => ({
    id: String(filter.value),
    label: filter.label,
    predicate:
      filter.value === 'all'
        ? undefined
        : (quote: Quote) => matchesQuoteStatusFilter(quote.status, filter.value),
  }));

  readonly serviceFilters: OdlFilter<Quote>[] = quoteServiceFilters().map((filter) => ({
    id: String(filter.value),
    label: filter.label,
    predicate:
      filter.value === 'all'
        ? undefined
        : (quote: Quote) => quoteIncludesService(quote, filter.value as ServiceType),
  }));

  readonly actions: OdlRowAction<Quote>[] = [
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly columns: OdlColumn<Quote>[] = [
    { key: 'id', header: 'Presupuesto', type: 'primary' },
    {
      key: 'customerName',
      header: 'Cliente',
      type: 'primary',
      value: (quote) => quote.customerName || 'Sin cliente',
      secondary: (quote) => this.quoteSummary(quote),
    },
    { key: 'services', header: 'Áreas', type: 'tags', tags: (quote) => quote.services.map(serviceTag) },
    { key: 'quotedAt', header: 'Fecha', type: 'date' },
    { key: 'status', header: 'Estado', type: 'badge', badge: (quote) => quoteStatusBadge(quote.status) },
    { key: 'total', header: 'Total', type: 'money' },
  ];

  ngOnInit(): void {
    this.loadQuotes();
    this.realtime.bindSmartReload(
      this.destroyRef,
      ['dashboard', 'quotes'],
      (event) => this.handleRealtime(event),
    );

    if (shouldOpenCreateFromQuery(this.route)) {
      this.openCreateQuote();
      clearCreateQuery(this.router);
    }
  }

  onAction(event: OdlActionEvent<Quote>): void {
    if (event.actionId === 'eliminar') this.deleteQuote(event.row);
  }

  private quoteSummary(quote: Quote): string {
    const concepts = quote.items.length;
    const units = quote.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const conceptWord = concepts === 1 ? 'concepto' : 'conceptos';
    const unitWord = units === 1 ? 'unidad' : 'unidades';
    return `${concepts} ${conceptWord} · ${units} ${unitWord}`;
  }

  loadQuotes(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.quotesService.getQuotes().subscribe({
      next: (quotes) => {
        this.quotes = this.sortByQuotedAtDesc(quotes);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  openCreateQuote(): void {
    this.formDialogs.openQuote().subscribe((saved) => {
      if (saved) this.onQuoteSaved(saved);
    });
  }

  openEditQuote(quote: Quote): void {
    this.formDialogs.openQuote(quote).subscribe((saved) => {
      if (saved) this.onQuoteSaved(saved);
    });
  }

  onQuoteSaved(saved: Quote): void {
    this.quotes = this.sortByQuotedAtDesc(upsertById(this.quotes, saved));
    this.cdr.markForCheck();
  }

  /** Emisión más reciente arriba; desempate por createdAt. */
  private sortByQuotedAtDesc(quotes: Quote[]): Quote[] {
    return [...quotes].sort((a, b) => {
      const byQuoted =
        new Date(b.quotedAt).getTime() - new Date(a.quotedAt).getTime();
      if (byQuoted !== 0) return byQuoted;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  deleteQuote(quote: Quote): void {
    if (!confirm(`¿Eliminar el presupuesto ${quote.id}?`)) return;

    const previous = this.quotes;
    this.quotes = removeById(this.quotes, quote.id);
    this.cdr.markForCheck();

    this.quotesService.deleteQuote(quote.id).subscribe({
      error: (err) => {
        this.quotes = previous;
        this.cdr.markForCheck();
        alert(extractApiErrorMessage(err, 'No se pudo eliminar el presupuesto'));
      },
    });
  }

  private handleRealtime(event: RealtimeEvent): void {
    if (event.entity === 'quote' || event.scope === 'dashboard') {
      this.loadQuotes();
    }
  }
}
