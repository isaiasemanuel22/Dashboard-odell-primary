import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Customer, Product, Quote } from '../../core/models';
import { CustomersService } from '../../core/services/customers.service';
import { ProductsService } from '../../core/services/products.service';
import { DbButtonComponent } from '@general-components';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';
import {
  QuoteDocumentFormat,
  buildQuoteDocumentInput,
  exportQuoteDocument,
} from '../utils/quote-document.util';

export interface QuoteDocumentExportDialogData {
  quote: Quote;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, DbButtonComponent],
  template: `
    <app-form-dialog-shell
      title="Generar presupuesto"
      size="sm"
      (close)="close()"
    >
      <p class="quote-export__message">
        Elegí el formato para descargar el documento con los datos del
        presupuesto y del cliente.
      </p>

      @if (error) {
        <p class="quote-export__error" role="alert">{{ error }}</p>
      }

      <div class="quote-export__actions">
        <db-button
          label="Cancelar"
          variant="secondary"
          format="soft"
          [disabled]="!!exporting"
          (clicked)="close()"
        />
        <db-button
          [label]="exporting === 'png' ? 'Generando…' : 'Descargar PNG'"
          variant="primary-outline"
          format="soft"
          [disabled]="!!exporting || !ready"
          (clicked)="exportAs('png')"
        />
        <db-button
          [label]="exporting === 'pdf' ? 'Generando…' : 'Descargar PDF'"
          variant="primary"
          format="solid"
          [disabled]="!!exporting || !ready"
          (clicked)="exportAs('pdf')"
        />
      </div>
    </app-form-dialog-shell>
  `,
  styles: `
    .quote-export__message {
      margin: 0 0 1rem;
      font-size: 0.95rem;
      line-height: 1.5;
      color: var(--color-text, #0f172a);
    }

    .quote-export__error {
      margin: 0 0 1rem;
      font-size: 0.875rem;
      color: #b91c1c;
    }

    .quote-export__busy {
      margin: 0.75rem 0 0;
      font-size: 0.85rem;
      color: var(--color-text-muted, #64748b);
    }

    .quote-export__actions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteDocumentExportDialogComponent implements OnInit {
  readonly data = inject<QuoteDocumentExportDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<void>);
  private readonly customersService = inject(CustomersService);
  private readonly productsService = inject(ProductsService);
  private readonly cdr = inject(ChangeDetectorRef);

  ready = false;
  exporting: QuoteDocumentFormat | null = null;
  error: string | null = null;

  private customer: Customer | null = null;
  private productsById = new Map<string, Product>();

  ngOnInit(): void {
    const quote = this.data.quote;
    const customer$ = quote.customerId
      ? this.customersService.getCustomer(quote.customerId).pipe(
          catchError(() => of(null)),
        )
      : of(null);

    const productIds = [
      ...new Set(
        quote.items
          .map((item) => item.productId)
          .filter((id): id is string => !!id),
      ),
    ];

    const products$ =
      productIds.length > 0
        ? forkJoin(
            productIds.map((id) =>
              this.productsService.getProduct(id).pipe(catchError(() => of(null))),
            ),
          )
        : of([] as Array<Product | null>);

    forkJoin({ customer: customer$, products: products$ }).subscribe({
      next: ({ customer, products }) => {
        this.customer = customer;
        this.productsById = new Map(
          products
            .filter((product): product is Product => !!product)
            .map((product) => [product.id, product]),
        );
        this.ready = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron cargar los datos para el documento.';
        this.ready = true;
        this.cdr.markForCheck();
      },
    });
  }

  close(): void {
    if (this.exporting) return;
    this.dialogRef.close();
  }

  async exportAs(format: QuoteDocumentFormat): Promise<void> {
    if (this.exporting || !this.ready) return;
    this.exporting = format;
    this.error = null;
    this.cdr.markForCheck();

    try {
      const doc = buildQuoteDocumentInput(
        this.data.quote,
        this.customer,
        this.productsById,
      );
      await exportQuoteDocument(doc, format);
      this.dialogRef.close();
    } catch (err) {
      console.error(err);
      this.error =
        format === 'pdf'
          ? 'No se pudo generar el PDF.'
          : 'No se pudo generar el PNG.';
      this.exporting = null;
      this.cdr.markForCheck();
    }
  }
}
