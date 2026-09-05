import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ActivatedRoute, Router } from '@angular/router';
import { Quote, QuoteStatus, ServiceType } from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { QuotesService } from '../../core/services/quotes.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { removeById, upsertById } from '../../core/utils/replace-in-store';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import {
  DbListToolbarComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  QuoteCardComponent,
} from '@general-components';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  clearCreateQuery,
  shouldOpenCreateFromQuery,
} from '../../shared/utils/create-from-query.util';
import {
  QuoteStatusFilter,
  matchesQuoteStatusFilter,
  quoteIncludesService,
  quoteServiceFilters,
  quoteStatusFilters,
} from '../../shared/utils/quote.helpers';

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [
    FormsModule,
    ScrollingModule,
    DbStateMessageComponent,
    DbSkeletonComponent,
    DbListToolbarComponent,
    DbButtonComponent,
    QuoteCardComponent,
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
  search = '';
  statusFilter: QuoteStatusFilter = 'activos';
  serviceFilter: ServiceType | 'all' = 'all';

  readonly statusFilters = quoteStatusFilters();
  readonly serviceFilters = quoteServiceFilters();

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

  get filteredQuotes(): Quote[] {
    const term = this.search.trim().toLowerCase();
    return this.quotes.filter((quote) => {
      if (!matchesQuoteStatusFilter(quote.status, this.statusFilter)) {
        return false;
      }
      if (
        this.serviceFilter !== 'all' &&
        !quoteIncludesService(quote, this.serviceFilter)
      ) {
        return false;
      }
      if (!term) return true;
      return [
        quote.id,
        quote.customerName,
        ...quote.items.map((item) => item.productName),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }

  get emptyMessage(): string {
    if (this.search.trim()) {
      return 'No hay presupuestos que coincidan con los filtros.';
    }
    if (this.statusFilter === 'activos') {
      return 'No hay presupuestos activos.';
    }
    if (this.statusFilter !== 'all' || this.serviceFilter !== 'all') {
      return 'No hay presupuestos que coincidan con los filtros.';
    }
    return 'No hay presupuestos registrados.';
  }

  setStatusFilter(filter: QuoteStatusFilter): void {
    this.statusFilter = filter;
    this.cdr.markForCheck();
  }

  setServiceFilter(filter: ServiceType | 'all'): void {
    this.serviceFilter = filter;
    this.cdr.markForCheck();
  }

  loadQuotes(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.quotesService.getQuotes().subscribe({
      next: (quotes) => {
        this.quotes = quotes;
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
    this.quotes = upsertById(this.quotes, saved);
    this.cdr.markForCheck();
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
