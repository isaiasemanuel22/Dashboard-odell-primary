import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CreateQuotePayload,
  Quote,
  QuoteStatus,
  ServiceType,
} from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { DataChangedService } from '../../core/services/data-changed.service';
import {
  MOBILE_LIST_KEYS,
  injectMobileListPersistence,
} from '../../core/services/mobile-list-state.service';
import { QuotesService } from '../../core/services/quotes.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { removeById, upsertById } from '../../core/utils/replace-in-store';
import { FormDialogService } from '../../modals/public-api';
import {
  DB_DATA_TABLE,
  DbButtonComponent,
  DbSkeletonComponent,
  MobileBarComponent,
  MobileListToolbarComponent,
  type MobileListToolbarChip,
  OdlActionEvent,
  OdlBadge,
  OdlColumn,
  OdlFilter,
  OdlRowAction,
  QuoteCardComponent,
  quoteStatusBadge,
  serviceTag,
} from '@general-components';
import { QuoteMobileCardComponent } from '../../components/quote-mobile-card/quote-mobile-card.component';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  clearCreateQuery,
  shouldOpenCreateFromQuery,
} from '../../shared/utils/create-from-query.util';
import {
  QuoteMobileChip,
  QuoteMobileSheetFilters,
  countQuoteMobileSheetFilters,
  emptyQuoteMobileSheetFilters,
  matchesQuoteMobileChip,
  matchesQuoteMobileSheetFilters,
  matchesQuoteStatusFilter,
  quoteIncludesService,
  quoteMobileChips,
  quoteServiceFilters,
  quoteStatusFilters,
  isQuoteEditable,
} from '../../shared/utils/quote.helpers';
import {
  QUOTE_EXPIRED_LABEL,
  isQuoteExpired,
} from '../../shared/utils/quote-validity.util';
import { normalizeSearchText } from '../../shared/utils/search-text.util';

interface QuotesMobileListState {
  chip: QuoteMobileChip;
  sheetFilters: QuoteMobileSheetFilters;
  search: string;
  scrollY: number;
}

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [
    FormsModule,
    DbButtonComponent,
    DbSkeletonComponent,
    MobileBarComponent,
    MobileListToolbarComponent,
    QuoteCardComponent,
    QuoteMobileCardComponent,
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
  private readonly dataChanged = inject(DataChangedService);
  private readonly listPersistence =
    injectMobileListPersistence<QuotesMobileListState>(MOBILE_LIST_KEYS.quotes);

  quotes: Quote[] = [];
  loading = true;
  search = '';
  mobileChip: QuoteMobileChip = 'abiertos';
  mobileSheetFilters: QuoteMobileSheetFilters = emptyQuoteMobileSheetFilters();
  /** Evita reabrir el modal si el botón recibe clicks/teclas repetidas. */
  private quoteDialogBusy = false;

  readonly mobileChips = quoteMobileChips();

  readonly searchText = (quote: Quote) =>
    [quote.id, quote.customerName, ...(quote.items ?? []).map((item) => item.productName)].join(' ');

  readonly statusFilters: OdlFilter<Quote>[] = quoteStatusFilters().map((filter) => ({
    id: String(filter.value),
    label: filter.label,
    predicate:
      filter.value === 'all'
        ? undefined
        : (quote: Quote) => matchesQuoteStatusFilter(quote, filter.value),
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
    { id: 'ver', label: 'Ver' },
    {
      id: 'editar',
      label: 'Editar',
      hidden: (quote) => !isQuoteEditable(quote.status),
    },
    { id: 'duplicar', label: 'Duplicar' },
    {
      id: 'eliminar',
      label: 'Eliminar',
      danger: true,
      hidden: (quote) => quote.status === 'aceptado',
    },
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
    { key: 'status', header: 'Estado', type: 'badge', badge: (quote) => this.statusBadge(quote) },
    { key: 'total', header: 'Total', type: 'money' },
  ];

  ngOnInit(): void {
    this.listPersistence.connect(() => ({
      chip: this.mobileChip,
      sheetFilters: this.mobileSheetFilters,
      search: this.search,
    }));
    this.listPersistence.restore((saved) => {
      this.mobileChip = saved.chip;
      this.mobileSheetFilters =
        saved.sheetFilters ?? emptyQuoteMobileSheetFilters();
      this.search = saved.search;
    });

    this.loadQuotes();
    this.dataChanged
      .on('quotes')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadQuotes());
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
    if (event.actionId === 'ver') {
      void this.router.navigate(['/presupuestos', event.row.id]);
    } else if (event.actionId === 'editar') {
      this.openEditQuote(event.row);
    } else if (event.actionId === 'duplicar') {
      this.duplicateQuote(event.row);
    } else if (event.actionId === 'eliminar') {
      this.deleteQuote(event.row);
    }
  }

  /** Crea un borrador nuevo con el mismo cliente y las mismas líneas. */
  duplicateQuote(quote: Quote): void {
    const payload: CreateQuotePayload = {
      // Precio de lista: el backend vuelve a aplicar el mayorista al guardar.
      items: (quote.items ?? []).map((item) => ({
        ...item,
        unitPrice: item.listUnitPrice ?? item.unitPrice,
        listUnitPrice: undefined,
      })),
      status: QuoteStatus.BORRADOR,
      ...(quote.customerId ? { customerId: quote.customerId } : {}),
      ...(quote.priceType ? { priceType: quote.priceType } : {}),
      ...(quote.salesChannel ? { salesChannel: quote.salesChannel } : {}),
      ...(quote.discountPercent
        ? { discountPercent: quote.discountPercent }
        : {}),
      ...(quote.discountAmount ? { discountAmount: quote.discountAmount } : {}),
      ...(quote.description ? { description: quote.description } : {}),
    };
    this.quotesService.createQuote(payload).subscribe({
      next: (created) => this.onQuoteSaved(created),
      error: (err) => {
        this.formDialogs
          .openConfirm({
            title: 'No se pudo duplicar',
            message: extractApiErrorMessage(
              err,
              'No se pudo duplicar el presupuesto',
            ),
            confirmLabel: 'Entendido',
            alertOnly: true,
          })
          .subscribe();
      },
    });
  }

  private statusBadge(quote: Quote): OdlBadge {
    return isQuoteExpired(quote)
      ? { label: QUOTE_EXPIRED_LABEL, tone: 'danger' }
      : quoteStatusBadge(quote.status);
  }

  private quoteSummary(quote: Quote): string {
    const concepts = quote.items?.length ?? 0;
    if (!concepts) return 'Sin líneas';
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
        this.listPersistence.onListReady();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get mobileToolbarChips(): MobileListToolbarChip[] {
    const counts = this.mobileChipCounts;
    return this.mobileChips.map((chip) => ({
      id: chip.value,
      label: chip.label,
      count: counts[chip.value],
    }));
  }

  get mobileFilteredQuotes(): Quote[] {
    const term = normalizeSearchText(this.search);
    return this.quotes.filter((quote) => {
      if (!matchesQuoteMobileChip(quote, this.mobileChip)) return false;
      if (!matchesQuoteMobileSheetFilters(quote, this.mobileSheetFilters)) {
        return false;
      }
      if (!term) return true;
      return normalizeSearchText(this.searchText(quote)).includes(term);
    });
  }

  /** Base de contadores: búsqueda + filtros de hoja (sin chip). */
  private get mobileCountBase(): Quote[] {
    const term = normalizeSearchText(this.search);
    return this.quotes.filter((quote) => {
      if (!matchesQuoteMobileSheetFilters(quote, this.mobileSheetFilters)) {
        return false;
      }
      if (!term) return true;
      return normalizeSearchText(this.searchText(quote)).includes(term);
    });
  }

  /** Lista para el contador en vivo de la hoja (chip + búsqueda, sin área). */
  private get mobileQuotesForSheet(): Quote[] {
    const term = normalizeSearchText(this.search);
    return this.quotes.filter((quote) => {
      if (!matchesQuoteMobileChip(quote, this.mobileChip)) return false;
      if (!term) return true;
      return normalizeSearchText(this.searchText(quote)).includes(term);
    });
  }

  get mobileSheetFilterCount(): number {
    return countQuoteMobileSheetFilters(this.mobileSheetFilters);
  }

  get filtersButtonLabel(): string {
    const n = this.mobileSheetFilterCount;
    return n > 0 ? `Filtros (${n})` : 'Filtros';
  }

  openMobileFilters(): void {
    this.formDialogs
      .openQuoteFilters({
        filters: this.mobileSheetFilters,
        quotes: this.mobileQuotesForSheet,
      })
      .subscribe((next) => {
        if (!next) return;
        this.mobileSheetFilters = next;
        this.cdr.markForCheck();
      });
  }

  get mobileChipCounts(): Record<QuoteMobileChip, number> {
    const counts = {
      abiertos: 0,
      vencidos: 0,
      todos: 0,
      [QuoteStatus.BORRADOR]: 0,
      [QuoteStatus.ENVIADO]: 0,
      [QuoteStatus.ACEPTADO]: 0,
      [QuoteStatus.RECHAZADO]: 0,
      [QuoteStatus.CANCELADO]: 0,
    } as Record<QuoteMobileChip, number>;

    for (const quote of this.mobileCountBase) {
      counts.todos += 1;
      if (matchesQuoteMobileChip(quote, 'abiertos')) counts.abiertos += 1;
      if (matchesQuoteMobileChip(quote, 'vencidos')) counts.vencidos += 1;
      if (matchesQuoteMobileChip(quote, quote.status)) counts[quote.status] += 1;
    }
    return counts;
  }

  get mobileEmptyMessage(): string {
    if (this.search.trim()) {
      return 'No hay presupuestos que coincidan con la búsqueda.';
    }
    if (this.mobileChip === 'abiertos') {
      return 'No hay presupuestos abiertos.';
    }
    if (this.mobileChip === 'vencidos') {
      return 'No hay presupuestos vencidos.';
    }
    return 'No hay presupuestos en este estado.';
  }

  onMobileChipChange(chipId: string): void {
    this.mobileChip = chipId as QuoteMobileChip;
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.cdr.markForCheck();
  }

  openCreateQuote(): void {
    if (this.quoteDialogBusy) return;
    this.quoteDialogBusy = true;
    this.formDialogs.openQuote().subscribe({
      next: (saved) => {
        if (saved) this.onQuoteSaved(saved);
      },
      complete: () => {
        this.quoteDialogBusy = false;
      },
      error: () => {
        this.quoteDialogBusy = false;
      },
    });
  }

  openEditQuote(quote: Quote): void {
    if (this.quoteDialogBusy) return;
    this.quoteDialogBusy = true;
    this.formDialogs.openQuote(quote).subscribe({
      next: (saved) => {
        if (saved) this.onQuoteSaved(saved);
      },
      complete: () => {
        this.quoteDialogBusy = false;
      },
      error: () => {
        this.quoteDialogBusy = false;
      },
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
    if (quote.status === 'aceptado') return;
    this.formDialogs
      .openConfirm({
        title: 'Eliminar presupuesto',
        message: `¿Eliminar el presupuesto ${quote.id}?`,
        confirmLabel: 'Eliminar',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const previous = this.quotes;
        this.quotes = removeById(this.quotes, quote.id);
        this.cdr.markForCheck();

        this.quotesService.deleteQuote(quote.id).subscribe({
          error: (err) => {
            this.quotes = previous;
            this.cdr.markForCheck();
            this.formDialogs
              .openConfirm({
                title: 'No se pudo eliminar',
                message: extractApiErrorMessage(err, 'No se pudo eliminar el presupuesto'),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }

  private handleRealtime(event: RealtimeEvent): void {
    if (event.entity === 'quote' || event.scope === 'dashboard') {
      this.loadQuotes();
    }
  }
}
