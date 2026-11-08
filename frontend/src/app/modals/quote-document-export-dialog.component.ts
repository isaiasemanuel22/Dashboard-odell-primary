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
import {
  Customer,
  Product,
  Quote,
  WholesaleDiscountSettings,
} from '../core/models';
import { CustomersService } from '../core/services/customers.service';
import { ProductsService } from '../core/services/products.service';
import { SettingsService } from '../core/services/settings.service';
import { DbButtonComponent } from '@general-components';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';
import {
  QuoteDocumentFormat,
  QuoteDocumentVariant,
  buildQuoteDocumentInput,
  exportQuoteDocument,
  isWholesaleQuote,
} from '../shared/utils/quote-document.util';
import { normalizeWholesaleDiscount } from '../shared/utils/wholesale-example.util';

export interface QuoteDocumentExportDialogData {
  quote: Quote;
  /** Comparativa lista vs. por mayor; si no, el diseño sigue el tipo de precio. */
  comparative?: boolean;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, DbButtonComponent],
  template: `
    <app-form-dialog-shell
      [title]="title"
      size="md"
      [footerBar]="true"
      (close)="close()"
    >
      <p class="quote-export__message">
        {{ message }}
      </p>

      @if (error) {
        <p class="quote-export__error" role="alert">{{ error }}</p>
      }

      <db-button
        modalFooter
        class="footer-row footer-row--cancel"
        label="Cancelar"
        variant="secondary"
        format="soft"
        [disabled]="!!exporting"
        (clicked)="close()"
      />
      <db-button
        modalFooter
        class="footer-row footer-row--outline"
        [label]="exporting === 'png' ? 'Generando…' : 'Descargar PNG'"
        variant="primary-outline"
        format="soft"
        [disabled]="!!exporting || !ready"
        (clicked)="exportAs('png')"
      />
      <db-button
        modalFooter
        class="footer-row"
        [label]="exporting === 'pdf' ? 'Generando…' : 'Descargar PDF'"
        variant="primary"
        format="solid"
        [disabled]="!!exporting || !ready"
        (clicked)="exportAs('pdf')"
      />
    </app-form-dialog-shell>
  `,
  styleUrl: './quote-document-export-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteDocumentExportDialogComponent implements OnInit {
  readonly data = inject<QuoteDocumentExportDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<void>);
  private readonly customersService = inject(CustomersService);
  private readonly productsService = inject(ProductsService);
  private readonly settingsService = inject(SettingsService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly variant: QuoteDocumentVariant = this.data.comparative
    ? 'comparativo'
    : isWholesaleQuote(this.data.quote)
      ? 'mayorista'
      : 'lista';

  readonly title =
    this.variant === 'comparativo'
      ? 'Generar presupuesto comparativo'
      : 'Generar presupuesto';

  readonly message =
    this.variant === 'comparativo'
      ? 'El documento muestra el precio de lista y el precio por mayor lado a lado. Elegí el formato para descargarlo.'
      : this.variant === 'mayorista'
        ? 'El documento sale con el diseño mayorista (precio de lista y precio de revendedor). Elegí el formato para descargarlo.'
        : 'Elegí el formato para descargar el documento con los datos del presupuesto y del cliente.';

  ready = false;
  exporting: QuoteDocumentFormat | null = null;
  error: string | null = null;

  private customer: Customer | null = null;
  private productsById = new Map<string, Product>();
  private wholesaleDiscount: WholesaleDiscountSettings =
    normalizeWholesaleDiscount(null);

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

    const settings$ = this.settingsService.getGeneralSettings().pipe(
      catchError(() => of(null)),
    );

    forkJoin({
      customer: customer$,
      products: products$,
      settings: settings$,
    }).subscribe({
      next: ({ customer, products, settings }) => {
        this.customer = customer;
        this.productsById = new Map(
          products
            .filter((product): product is Product => !!product)
            .map((product) => [product.id, product]),
        );
        this.wholesaleDiscount = normalizeWholesaleDiscount(
          settings?.wholesaleDiscount ?? null,
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
        this.wholesaleDiscount,
      );
      await exportQuoteDocument(doc, this.variant, format);
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
