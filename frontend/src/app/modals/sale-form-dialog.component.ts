import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  CreateRetailSalePayload,
  Product,
  ProductStockOverview,
  RetailSale,
  UpdateRetailSalePayload,
} from '../core/models';
import { ProductsService } from '../core/services/products.service';
import { SalesService } from '../core/services/sales.service';
import { SaleCartService } from '../core/services/sale-cart.service';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../shared/utils/api-error';
import { productStockOverview } from '../shared/utils/stock.helpers';
import { guardDialogDismiss } from './dialog-dismiss-guard';
import { SaleFormComponent } from '../pages/sales/sale-form/sale-form.component';

export interface SaleFormDialogData {
  sale: RetailSale | null;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, SaleFormComponent],
  template: `
    <app-form-dialog-shell
      [title]="sale ? 'Editar venta' : 'Nueva venta en mostrador'"
      subtitle="Productos publicados con stock · el stock se descuenta al cobrar"
      size="wide"
      [footerBar]="true"
      [stickyHeader]="true"
      (close)="requestDismiss()"
    >
      <app-sale-form
        #saleForm
        [sale]="sale"
        [products]="products"
        [stockByProductId]="stockByProductId"
        [loading]="loading"
        [error]="error"
        (save)="save($event)"
        (cancel)="cancel()"
      />
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleFormDialogComponent implements OnInit {
  private readonly salesService = inject(SalesService);
  private readonly productsService = inject(ProductsService);
  private readonly saleCart = inject(SaleCartService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<RetailSale>);
  private readonly data = inject<SaleFormDialogData>(DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('saleForm') saleForm?: SaleFormComponent;

  sale: RetailSale | null = null;
  products: Product[] = [];
  stockByProductId: Record<string, ProductStockOverview> = {};
  loading = false;
  error = '';

  ngOnInit(): void {
    this.sale = this.data.sale;
    this.resetState();
    this.loadProducts();
    guardDialogDismiss(this.dialogRef, this.destroyRef, () =>
      this.requestDismiss(),
    );
  }

  /** Backdrop, Esc y X: pregunta antes de descartar si hay cambios. */
  requestDismiss(): void {
    if (this.saleForm) {
      this.saleForm.requestCancel();
      return;
    }
    this.cancel();
  }

  save(data: CreateRetailSalePayload): void {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const request = this.sale
      ? this.salesService.updateRetailSale(
          this.sale.id,
          data as UpdateRetailSalePayload,
        )
      : this.salesService.createRetailSale(data);

    request.subscribe({
      next: (saved) => {
        this.loading = false;
        if (!this.sale) {
          this.saleCart.clear();
        }
        this.dialogRef.close(saved);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'Error al cerrar la venta');
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private loadProducts(): void {
    this.productsService.getProducts(undefined, { all: true }).subscribe({
      next: (products) => {
        this.products = products;
        this.stockByProductId = Object.fromEntries(
          products.map((product) => [
            product.id,
            productStockOverview(product, undefined, products),
          ]),
        );
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = extractApiErrorMessage(
          err,
          'No se pudieron cargar los productos. Cerrá y volvé a abrir para reintentar.',
        );
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
