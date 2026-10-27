import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { forkJoin } from 'rxjs';
import {
  CreateQuotePayload,
  Customer,
  Product,
  Quote,
  UpdateQuotePayload,
} from '../../core/models';
import { CustomerCatalogService } from '../../core/services/customer-catalog.service';
import { ProductCatalogService } from '../../core/services/product-catalog.service';
import { QuotesService } from '../../core/services/quotes.service';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../utils/api-error';
import { OrderFormComponent, OrderFormSavePayload } from '../../pages/orders/order-form/order-form.component';

export interface QuoteFormDialogData {
  quote?: Quote | null;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, OrderFormComponent],
  template: `
    <app-form-dialog-shell
      [title]="quote ? 'Editar presupuesto' : 'Nuevo presupuesto'"
      [subtitle]="
        quote
          ? 'Editá la cotización antes de confirmar el pedido.'
          : 'Cotización para un cliente antes de confirmar el pedido.'
      "
      size="lg"
      [stickyHeader]="true"
      (close)="cancel()"
    >
      <app-order-form
        variant="quote"
        [quote]="quote"
        [customers]="customers"
        [products]="products"
        [loading]="loading"
        [error]="error"
        (save)="save($event)"
        (cancel)="cancel()"
        (customerCreated)="onCustomerCreated($event)"
      />
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteFormDialogComponent implements OnInit {
  private readonly quotesService = inject(QuotesService);
  private readonly customerCatalog = inject(CustomerCatalogService);
  private readonly productCatalog = inject(ProductCatalogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<Quote>);
  private readonly data = inject<QuoteFormDialogData>(DIALOG_DATA, {
    optional: true,
  });

  quote: Quote | null = null;
  customers: Customer[] = [];
  products: Product[] = [];
  loading = false;
  error = '';

  ngOnInit(): void {
    this.quote = this.data?.quote ?? null;
    this.resetState();
    this.loadCatalogs();
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
        this.dialogRef.close(saved);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'Error al guardar el presupuesto');
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  onCustomerCreated(customer: Customer): void {
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
      },
    });
  }

  private resetState(): void {
    this.loading = false;
    this.error = '';
    this.cdr.markForCheck();
  }
}
