import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Quote,
  QuoteItem,
  QuoteStatus,
} from '../../../core/models';
import { QuotesService } from '../../../core/services/quotes.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { FormDialogService } from '../../../modals/public-api';
import {
  DbButtonComponent,
  DbServiceBadgesComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbStatusBadgeComponent,
  MobileBarComponent,
  MobileDockComponent,
  MobileSheetComponent,
  MobileTotalsComponent,
  type MobileDockAction,
  type MobileTotalRow,
} from '@general-components';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import {
  canGenerateOrderFromQuote,
  formatQuoteValidityLabel,
  isQuoteEditable,
  quoteEstimatedProfit,
  quoteStatusPillClass,
} from '../../../shared/utils/quote.helpers';
import {
  calculateLinePriceTotal,
  calculateOrderDiscount,
  calculateOrderSubtotal,
  isDesignService,
} from '../../../shared/utils/order.helpers';
import { isThirdPartyService } from '../../../shared/utils/service-type.util';
import { resolveLinePrintUnitPrice } from '../../../shared/utils/design-print.util';
import { DEPOSIT_FACTOR } from '../../../shared/utils/quote-document.util';
import { salesChannelLabel } from '../../../shared/utils/v1-labels.util';
import { QUOTE_STATUS_LABELS, serviceTypeLabel } from '../../../shared/constants/labels';
import {
  CurrencyArsPipe,
  DateShortPipe,
  QuoteStatusLabelPipe,
  RichTextPipe,
} from '../../../shared/pipes/labels.pipe';
import { QuoteDetailLinesComponent } from './quote-detail-lines/quote-detail-lines.component';
import { DocumentAttachmentsViewComponent } from '../../../components/document-attachments-view/document-attachments-view.component';

@Component({
  selector: 'app-quote-detail',
  standalone: true,
  imports: [
    DocumentAttachmentsViewComponent,
    RouterLink,
    DateShortPipe,
    QuoteStatusLabelPipe,
    RichTextPipe,
    CurrencyArsPipe,
    DbSkeletonComponent,
    DbStateMessageComponent,
    DbButtonComponent,
    DbStatusBadgeComponent,
    DbServiceBadgesComponent,
    MobileBarComponent,
    MobileDockComponent,
    MobileSheetComponent,
    MobileTotalsComponent,
    QuoteDetailLinesComponent,
  ],
  templateUrl: './quote-detail.component.html',
  styleUrl: './quote-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyArsPipe],
})
export class QuoteDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quotesService = inject(QuotesService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly currencyArs = inject(CurrencyArsPipe);

  quote: Quote | null = null;
  loading = true;
  notFound = false;
  statusLoading = false;
  generatingOrder = false;
  mobileActionsOpen = false;

  readonly QuoteStatus = QuoteStatus;
  readonly depositPercent = Math.round(DEPOSIT_FACTOR * 100);
  readonly isDesignService = isDesignService;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        if (!id) {
          this.notFound = true;
          this.loading = false;
          this.cdr.markForCheck();
          return;
        }
        this.loadQuote(id);
      });

    this.realtime.bindSmartReload(
      this.destroyRef,
      ['dashboard'],
      () => {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) this.loadQuote(id);
      },
    );
  }

  get editable(): boolean {
    return this.quote ? isQuoteEditable(this.quote.status) : false;
  }

  /**
   * Misma transición que desktop vía «Guardar borrador» del formulario
   * (updateQuote con status BORRADOR) cuando el presupuesto está Enviado.
   */
  get canReturnToDraft(): boolean {
    return this.quote?.status === QuoteStatus.ENVIADO;
  }

  /** Borrador vacío: no se puede exportar, enviar ni aceptar. */
  get hasNoLines(): boolean {
    return !!this.quote && !this.quote.items?.length;
  }

  readonly noLinesHint =
    'Sin líneas todavía — editá el borrador para agregarlas';

  /** Pasar a Enviado o Aceptado exige al menos una línea. */
  statusNeedsLines(status: QuoteStatus): boolean {
    return (
      this.hasNoLines &&
      (status === QuoteStatus.ENVIADO || status === QuoteStatus.ACEPTADO)
    );
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

  get quoteValidityLabel(): string {
    return formatQuoteValidityLabel(this.quote?.quotedAt);
  }

  get mobileValidityLabel(): string {
    if (!this.quote) return '';
    // Artboard: «Válido hasta 15/11/2026».
    const base = new Date(this.quote.quotedAt ?? Date.now());
    const validUntil = new Date(base);
    validUntil.setDate(validUntil.getDate() + 15);
    return `Válido hasta ${validUntil.getDate()}/${validUntil.getMonth() + 1}/${validUntil.getFullYear()}`;
  }

  get statusPillClass(): string {
    return this.quote ? quoteStatusPillClass(this.quote.status) : 'm-pill';
  }

  get salesChannelPill(): string | null {
    if (!this.quote?.salesChannel) return null;
    const label = salesChannelLabel(this.quote.salesChannel);
    return label ? `Canal: ${label}` : null;
  }

  get wholesalePill(): string | null {
    if (!this.quote?.wholesaleApplied) return null;
    const percent = this.wholesalePercentFromItems();
    if (percent != null && percent > 0) return `Mayorista −${percent}%`;
    return 'Mayorista';
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

  get discountLabel(): string {
    if (!this.quote) return 'Descuento';
    if (this.quote.wholesaleApplied) {
      const percent = this.wholesalePercentFromItems();
      if (percent != null && percent > 0) {
        return `Descuento mayorista`;
      }
    }
    const percent = this.quote.discountPercent ?? 0;
    if (percent > 0) {
      const formatted = percent.toLocaleString('es-AR', {
        maximumFractionDigits: 2,
      });
      return `Descuento ${formatted}%`;
    }
    return 'Descuento';
  }

  get depositAmount(): number {
    return this.quote ? Math.round(this.quote.total * DEPOSIT_FACTOR) : 0;
  }

  get estimatedProfit(): number {
    return this.quote ? quoteEstimatedProfit(this.quote) : 0;
  }

  get mobileTotalRows(): MobileTotalRow[] {
    if (!this.quote) return [];
    const rows: MobileTotalRow[] = [
      {
        label: 'Subtotal a lista',
        value: this.currencyArs.transform(this.quoteSubtotal),
      },
    ];
    if (this.quoteDiscount > 0) {
      rows.push({
        label: this.discountLabel,
        value: `−${this.currencyArs.transform(this.quoteDiscount)}`,
        tone: 'danger',
      });
    }
    rows.push(
      {
        label: 'Total',
        value: this.currencyArs.transform(this.quote.total),
        tone: 'emphasis',
        strong: true,
      },
      {
        label: `Seña sugerida ${this.depositPercent} %`,
        value: this.currencyArs.transform(this.depositAmount),
        labelHint: true,
      },
      {
        label: 'Ganancia estimada',
        value: this.quoteHasLoadedCost
          ? this.currencyArs.transform(this.estimatedProfit)
          : 'Sin costo cargado',
        labelHint: true,
        tone: this.quoteHasLoadedCost
          ? this.estimatedProfit >= 0
            ? 'success'
            : 'danger'
          : 'default',
      },
    );
    return rows;
  }

  /** Hay al menos una línea propia con unitCost > 0. */
  get quoteHasLoadedCost(): boolean {
    if (!this.quote) return false;
    return this.quote.items.some((item) => {
      if (isThirdPartyService(item.serviceType)) return false;
      return (Number(item.unitCost) || 0) > 0;
    });
  }

  /** Exportar siempre; CTA primario según desktop. */
  get showMobileDock(): boolean {
    return !!this.quote;
  }

  get showMobileAccept(): boolean {
    if (!this.quote) return false;
    if (this.quote.orderId) return false;
    return this.canGenerateOrder || this.editable;
  }

  get mobileAcceptLabel(): string {
    if (this.canGenerateOrder) return 'Aceptar y crear pedido';
    return 'Aceptar y crear pedido';
  }

  get mobileDockActions(): MobileDockAction[] {
    if (!this.quote) return [];
    const actions: MobileDockAction[] = [
      {
        id: 'pdf',
        label: 'Exportar PDF',
        kind: 'secondary',
        disabled: this.hasNoLines,
      },
    ];
    if (this.quote.orderId) {
      actions.push({ id: 'view-order', label: 'Ver pedido', kind: 'primary' });
    } else if (this.showMobileAccept) {
      actions.push({
        id: 'accept',
        label: this.mobileAcceptLabel,
        kind: 'primary',
        disabled:
          this.generatingOrder || this.statusLoading || this.hasNoLines,
      });
    }
    return actions;
  }

  onMobileDockAction(id: string): void {
    if (id === 'pdf') {
      this.generateDocument();
      return;
    }
    if (id === 'view-order' && this.quote?.orderId) {
      void this.router.navigate(['/pedidos', this.quote.orderId]);
      return;
    }
    if (id === 'accept') {
      this.onMobileAccept();
    }
  }

  /** Opciones del selector de estado (actual + transiciones, sin cancelado). */
  mobileStatusOptions(): Array<{ status: QuoteStatus; label: string }> {
    if (!this.quote || !this.editable) return [];
    const current = this.quote.status;
    const allowed = new Set<QuoteStatus>([
      current,
      ...this.statusActions()
        .map((a) => a.status)
        .filter((s) => s !== QuoteStatus.CANCELADO),
    ]);
    const order = [
      QuoteStatus.BORRADOR,
      QuoteStatus.ENVIADO,
      QuoteStatus.ACEPTADO,
      QuoteStatus.RECHAZADO,
    ];
    return order
      .filter((status) => allowed.has(status))
      .map((status) => ({
        status,
        label: QUOTE_STATUS_LABELS[status],
      }));
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

  lineHasListPrice(item: QuoteItem): boolean {
    return item.listUnitPrice != null && Number(item.listUnitPrice) > 0;
  }

  printUnitPrice(item: QuoteItem): number {
    return resolveLinePrintUnitPrice(item);
  }

  serviceLabel(item: QuoteItem): string {
    return serviceTypeLabel(item.serviceType);
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

  generateDocument(): void {
    if (!this.quote || this.hasNoLines) return;
    this.formDialogs.openQuoteDocumentExport(this.quote).subscribe();
  }

  generateComparativeDocument(): void {
    if (!this.quote || this.hasNoLines) return;
    this.formDialogs.openQuoteDocumentExport(this.quote, true).subscribe();
  }

  onMobileComparative(): void {
    this.closeMobileActions();
    this.generateComparativeDocument();
  }

  generateOrder(): void {
    if (!this.quote || !this.canGenerateOrder || this.generatingOrder) return;
    if (this.hasNoLines) return;

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
        this.formDialogs
          .openConfirm({
            title: 'No se pudo generar el pedido',
            message: extractApiErrorMessage(err, 'No se pudo generar el pedido'),
            confirmLabel: 'Entendido',
            alertOnly: true,
          })
          .subscribe();
      },
    });
  }

  /** Dock: aceptar (si editable) o generar pedido (si ya aceptado). */
  onMobileAccept(): void {
    if (!this.quote) return;
    if (this.canGenerateOrder) {
      this.generateOrder();
      return;
    }
    if (this.editable) {
      this.updateStatus(QuoteStatus.ACEPTADO);
    }
  }

  updateStatus(status: QuoteStatus): void {
    if (!this.quote || this.statusLoading) return;
    if (status === this.quote.status) return;
    if (this.statusNeedsLines(status)) return;
    if (status === QuoteStatus.ACEPTADO) {
      const createsProduct = this.quote.items.some((item) => !item.productId);
      const message = createsProduct
        ? 'Aceptar crea el pedido y, si la línea no tiene producto de catálogo, un producto sin publicar. ¿Seguir?'
        : 'Aceptar crea el pedido a partir de este presupuesto. ¿Seguir?';
      this.formDialogs
        .openConfirm({
          title: 'Aceptar presupuesto',
          message,
          confirmLabel: 'Aceptar',
        })
        .subscribe((confirmed) => {
          if (confirmed) this.applyStatus(status);
        });
      return;
    }
    this.applyStatus(status);
  }

  private applyStatus(status: QuoteStatus): void {
    if (!this.quote || this.statusLoading) return;
    this.statusLoading = true;
    this.cdr.markForCheck();

    this.quotesService.updateQuoteStatus(this.quote.id, status).subscribe({
      next: (updated) => {
        this.quote = updated;
        this.statusLoading = false;
        this.cdr.markForCheck();
        if (updated.orderId) {
          void this.router.navigate(['/pedidos', updated.orderId]);
        }
      },
      error: (err) => {
        this.statusLoading = false;
        this.cdr.markForCheck();
        this.formDialogs
          .openConfirm({
            title: 'No se pudo actualizar',
            message: extractApiErrorMessage(err, 'No se pudo actualizar el estado'),
            confirmLabel: 'Entendido',
            alertOnly: true,
          })
          .subscribe();
      },
    });
  }

  deleteQuote(): void {
    if (!this.quote || this.quote.status === QuoteStatus.ACEPTADO) return;
    this.formDialogs
      .openConfirm({
        title: 'Eliminar presupuesto',
        message: `¿Eliminar el presupuesto ${this.quote.id}?`,
        confirmLabel: 'Eliminar',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed || !this.quote) return;
        this.quotesService.deleteQuote(this.quote.id).subscribe({
          next: () => void this.router.navigate(['/presupuestos']),
          error: (err) => {
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

  openMobileActions(): void {
    this.mobileActionsOpen = true;
    this.cdr.markForCheck();
  }

  closeMobileActions(): void {
    if (!this.mobileActionsOpen) return;
    this.mobileActionsOpen = false;
    this.cdr.markForCheck();
  }

  onMobileEdit(): void {
    this.closeMobileActions();
    this.openEdit();
  }

  onMobileReturnToDraft(): void {
    this.closeMobileActions();
    this.updateStatus(QuoteStatus.BORRADOR);
  }

  onMobileCancelStatus(): void {
    this.closeMobileActions();
    this.updateStatus(QuoteStatus.CANCELADO);
  }

  onMobileDelete(): void {
    this.closeMobileActions();
    this.deleteQuote();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeMobileActions();
  }

  private wholesalePercentFromItems(): number | null {
    if (!this.quote?.wholesaleApplied) return null;
    for (const item of this.quote.items) {
      const list = Number(item.listUnitPrice);
      const unit = Number(item.unitPrice);
      if (
        Number.isFinite(list) &&
        list > 0 &&
        Number.isFinite(unit) &&
        unit < list
      ) {
        return Math.round((1 - unit / list) * 100);
      }
    }
    return null;
  }

  private loadQuote(id: string): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.quotesService
      .getQuote(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (quote) => {
        if (this.route.snapshot.paramMap.get('id') !== id) return;
        this.quote = quote;
        this.loading = false;
        this.notFound = false;
        this.cdr.markForCheck();
      },
      error: () => {
        if (this.route.snapshot.paramMap.get('id') !== id) return;
        this.quote = null;
        this.loading = false;
        this.notFound = true;
        this.cdr.markForCheck();
      },
    });
  }
}
