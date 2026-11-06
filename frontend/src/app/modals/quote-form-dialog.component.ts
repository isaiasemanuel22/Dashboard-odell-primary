import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { filter, forkJoin } from 'rxjs';
import {
  CreateQuotePayload,
  Customer,
  Product,
  Quote,
  UpdateQuotePayload,
} from '../core/models';
import { BreakpointService } from '../core/services/breakpoint.service';
import { CustomerCatalogService } from '../core/services/customer-catalog.service';
import { ProductCatalogService } from '../core/services/product-catalog.service';
import { QuotesService } from '../core/services/quotes.service';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';
import { MobileFormShellComponent } from '../components/mobile-form-shell/mobile-form-shell.component';
import { confirmMobileFormDiscard } from '../components/mobile-form-shell/confirm-mobile-form-discard';
import { extractApiErrorMessage } from '../shared/utils/api-error';
import {
  OrderFormComponent,
  OrderFormSavePayload,
} from '../pages/orders/order-form/order-form.component';
import { FormDialogService } from './form-dialog.service';

export interface QuoteFormDialogData {
  quote?: Quote | null;
  presetCustomerId?: string;
}

@Component({
  standalone: true,
  imports: [
    FormDialogShellComponent,
    MobileFormShellComponent,
    OrderFormComponent,
  ],
  template: `
    <app-form-dialog-shell
      [title]="dialogTitle"
      [subtitle]="dialogSubtitle"
      size="xl"
      [stickyHeader]="true"
      (close)="cancel()"
    >
      @if (isMobile()) {
        <db-mobile-form-shell
          [title]="dialogTitle"
          headerActionLabel="Guardar borrador"
          [headerActionDisabled]="loading || !canSaveDraft"
          discardEntityLabel="el presupuesto"
          [isDirty]="!!form?.hasUnsavedChanges()"
          (close)="forceClose()"
          (headerAction)="saveDraft()"
        >
          <app-order-form
            variant="quote"
            [quote]="quote"
            [customers]="customers"
            [products]="products"
            [presetCustomerId]="presetCustomerId"
            [loading]="loading"
            [error]="error"
            (save)="save($event)"
            (cancel)="cancel()"
            (customerCreated)="onCustomerCreated($event)"
            (uiMetaChange)="onFormUiMeta()"
          />
        </db-mobile-form-shell>
      } @else {
        <app-order-form
          variant="quote"
          [quote]="quote"
          [customers]="customers"
          [products]="products"
          [presetCustomerId]="presetCustomerId"
          [loading]="loading"
          [error]="error"
          (save)="save($event)"
          (cancel)="cancel()"
          (customerCreated)="onCustomerCreated($event)"
          (uiMetaChange)="onFormUiMeta()"
        />
      }
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteFormDialogComponent implements OnInit, AfterViewInit {
  private readonly quotesService = inject(QuotesService);
  private readonly customerCatalog = inject(CustomerCatalogService);
  private readonly productCatalog = inject(ProductCatalogService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(DialogRef<Quote>);
  private readonly data = inject<QuoteFormDialogData>(DIALOG_DATA, {
    optional: true,
  });

  @ViewChild(OrderFormComponent) form?: OrderFormComponent;
  @ViewChild(MobileFormShellComponent)
  private mobileShell?: MobileFormShellComponent;

  readonly isMobile = this.breakpoint.isMobile;

  quote: Quote | null = null;
  presetCustomerId = '';
  customers: Customer[] = [];
  products: Product[] = [];
  loading = false;
  error = '';
  formSubtitle = '';
  canSaveDraft = false;
  private closing = false;
  private confirmingDiscard = false;

  get dialogTitle(): string {
    return this.quote ? 'Editar presupuesto' : 'Nuevo presupuesto';
  }

  get dialogSubtitle(): string {
    return (
      this.formSubtitle ||
      this.form?.modalSubtitle ||
      'Cotización para un cliente antes de confirmar el pedido'
    );
  }

  ngOnInit(): void {
    this.quote = this.data?.quote ?? null;
    this.presetCustomerId = this.data?.presetCustomerId ?? '';
    this.resetState();
    this.loadCatalogs();
    this.dialogRef.disableClose = true;
    this.dialogRef.backdropClick
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cancel());
    this.dialogRef.keydownEvents
      .pipe(
        filter((event) => event.key === 'Escape'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        event.preventDefault();
        this.cancel();
      });
  }

  ngAfterViewInit(): void {
    this.onFormUiMeta();
  }

  onFormUiMeta(): void {
    this.formSubtitle = this.form?.modalSubtitle ?? this.formSubtitle;
    this.canSaveDraft = !!this.form?.canSubmit(true);
    this.cdr.markForCheck();
  }

  saveDraft(): void {
    this.form?.onSubmit(true);
  }

  save(data: OrderFormSavePayload): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const request = this.quote
      ? this.quotesService.updateQuote(
          this.quote.id,
          data as UpdateQuotePayload,
        )
      : this.quotesService.createQuote(data as CreateQuotePayload);

    request.subscribe({
      next: (saved) => {
        this.loading = false;
        this.closing = true;
        this.dialogRef.close(saved);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(
          err,
          'Error al guardar el presupuesto',
        );
        this.cdr.markForCheck();
      },
    });
  }

  forceClose(): void {
    if (this.closing) return;
    this.closing = true;
    this.dialogRef.close();
  }

  cancel(): void {
    if (this.closing || this.confirmingDiscard) return;

    if (this.isMobile() && this.mobileShell) {
      this.mobileShell.requestClose();
      return;
    }

    this.confirmingDiscard = true;
    confirmMobileFormDiscard(this.formDialogs, {
      hasChanges: !!this.form?.hasUnsavedChanges(),
      entityLabel: 'el presupuesto',
    }).subscribe((confirmed) => {
      this.confirmingDiscard = false;
      if (confirmed) this.forceClose();
    });
  }

  onCustomerCreated(customer: Customer): void {
    this.customerCatalog.upsert(customer);
    const exists = this.customers.some((item) => item.id === customer.id);
    this.customers = exists
      ? this.customers.map((item) =>
          item.id === customer.id ? customer : item,
        )
      : [...this.customers, customer].sort((a, b) =>
          a.name.localeCompare(b.name, 'es'),
        );
    this.cdr.markForCheck();
  }

  private loadCatalogs(): void {
    forkJoin({
      customers: this.customerCatalog.getCustomers(),
      products: this.productCatalog.getAllProducts(),
    }).subscribe({
      next: ({ customers, products }) => {
        this.customers = customers;
        this.products = products;
        this.cdr.markForCheck();
        void Promise.resolve().then(() => this.onFormUiMeta());
      },
    });
  }

  private resetState(): void {
    this.loading = false;
    this.error = '';
    this.cdr.markForCheck();
  }
}
