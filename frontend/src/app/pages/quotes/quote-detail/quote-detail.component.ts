import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Quote,
  QuoteItem,
  QuoteStatus,
} from '../../../core/models';
import { QuotesService } from '../../../core/services/quotes.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import {
  DbButtonComponent,
  DbServiceBadgesComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbStatusBadgeComponent,
} from '@general-components';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import {
  calculateLinePriceTotal,
  calculateOrderDiscount,
  calculateOrderSubtotal,
  isDesignService,
} from '../../../shared/utils/order.helpers';
import { resolveLinePrintUnitPrice } from '../../../shared/utils/design-print.util';
import {
  canGenerateOrderFromQuote,
  isQuoteEditable,
} from '../../../shared/utils/quote.helpers';
import { QUOTE_STATUS_LABELS } from '../../../shared/constants/labels';
import {
  CurrencyArsPipe,
  DateShortPipe,
  QuoteStatusLabelPipe,
  ServiceTypeLabelPipe,
} from '../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-quote-detail',
  standalone: true,
  imports: [
    RouterLink,
    DateShortPipe,
    CurrencyArsPipe,
    QuoteStatusLabelPipe,
    ServiceTypeLabelPipe,
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbButtonComponent,
    DbStatusBadgeComponent,
    DbServiceBadgesComponent,
  ],
  templateUrl: './quote-detail.component.html',
  styleUrl: './quote-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quotesService = inject(QuotesService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  quote: Quote | null = null;
  loading = true;
  notFound = false;
  statusLoading = false;
  generatingOrder = false;

  readonly isDesignService = isDesignService;
  readonly QuoteStatus = QuoteStatus;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound = true;
      this.loading = false;
      return;
    }

    this.loadQuote(id);
    this.realtime.bindSmartReload(
      this.destroyRef,
      ['dashboard'],
      () => this.loadQuote(id),
    );
  }

  get editable(): boolean {
    return this.quote ? isQuoteEditable(this.quote.status) : false;
  }

  get canGenerateOrder(): boolean {
    return this.quote
      ? canGenerateOrderFromQuote(this.quote.status) && !this.quote.orderId
      : false;
  }

  get generateOrderLabel(): string {
    if (this.quote?.status === QuoteStatus.ACEPTADO && this.quote.orderId) {
      return 'Ver pedido';
    }
    return 'Generar pedido';
  }

  get quoteSubtotal(): number {
    return this.quote ? calculateOrderSubtotal(this.quote.items) : 0;
  }

  get quoteDiscount(): number {
    if (!this.quote) return 0;
    return calculateOrderDiscount(
      this.quote.items,
      this.quote.discountPercent,
      this.quote.discountAmount,
    );
  }

  statusActions(): Array<{ status: QuoteStatus; label: string }> {
    if (!this.quote || !this.editable) return [];
    return (
      [
        QuoteStatus.ENVIADO,
        QuoteStatus.ACEPTADO,
        QuoteStatus.RECHAZADO,
        QuoteStatus.CANCELADO,
      ] as const
    )
      .filter((status) => status !== this.quote!.status)
      .map((status) => ({
        status,
        label: QUOTE_STATUS_LABELS[status],
      }));
  }

  lineSubtotal(item: QuoteItem): number {
    return calculateLinePriceTotal(item);
  }

  printUnitPrice(item: QuoteItem): number {
    return resolveLinePrintUnitPrice(item);
  }

  openEdit(): void {
    if (!this.quote) return;
    this.formDialogs.openQuote(this.quote).subscribe((updated) => {
      if (updated) {
        this.quote = updated;
        this.cdr.markForCheck();
      }
    });
  }

  generateOrder(): void {
    if (!this.quote || !this.canGenerateOrder || this.generatingOrder) return;

    const quote = this.quote;

    if (quote.orderId) {
      void this.router.navigate(['/pedidos', quote.orderId]);
      return;
    }

    if (quote.status !== QuoteStatus.ACEPTADO) return;

    this.generatingOrder = true;
    this.cdr.markForCheck();

    this.quotesService.createOrderFromQuote(quote.id).subscribe({
      next: (order) => {
        this.quote = { ...quote, orderId: order.id };
        this.generatingOrder = false;
        this.cdr.markForCheck();
        void this.router.navigate(['/pedidos', order.id]);
      },
      error: (err) => {
        this.generatingOrder = false;
        this.cdr.markForCheck();
        alert(extractApiErrorMessage(err, 'No se pudo generar el pedido'));
      },
    });
  }

  updateStatus(status: QuoteStatus): void {
    if (!this.quote || this.statusLoading) return;
    this.statusLoading = true;
    this.cdr.markForCheck();

    this.quotesService.updateQuoteStatus(this.quote.id, status).subscribe({
      next: (updated) => {
        this.quote = updated;
        this.statusLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.statusLoading = false;
        this.cdr.markForCheck();
        alert(extractApiErrorMessage(err, 'No se pudo actualizar el estado'));
      },
    });
  }

  deleteQuote(): void {
    if (!this.quote) return;
    if (!confirm(`¿Eliminar el presupuesto ${this.quote.id}?`)) return;

    this.quotesService.deleteQuote(this.quote.id).subscribe({
      next: () => void this.router.navigate(['/presupuestos']),
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo eliminar el presupuesto'));
      },
    });
  }

  private loadQuote(id: string): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.quotesService.getQuote(id).subscribe({
      next: (quote) => {
        this.quote = quote;
        this.loading = false;
        this.notFound = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.quote = null;
        this.loading = false;
        this.notFound = true;
        this.cdr.markForCheck();
      },
    });
  }
}
