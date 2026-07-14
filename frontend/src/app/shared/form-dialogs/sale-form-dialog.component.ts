import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  CreateRetailSalePayload,
  Product,
  RetailSale,
  UpdateRetailSalePayload,
} from '../../core/models';
import { ProductsService } from '../../core/services/products.service';
import { SalesService } from '../../core/services/sales.service';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../utils/api-error';
import { SaleFormComponent } from '../../pages/sales/sale-form/sale-form.component';

export interface SaleFormDialogData {
  sale: RetailSale | null;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, SaleFormComponent],
  template: `
    <app-form-dialog-shell
      [title]="sale ? 'Editar venta' : 'Nueva venta en mostrador'"
      size="lg"
      [stickyHeader]="true"
      (close)="cancel()"
    >
      <app-sale-form
        [sale]="sale"
        [products]="products"
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
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<RetailSale>);
  private readonly data = inject<SaleFormDialogData>(DIALOG_DATA);

  sale: RetailSale | null = null;
  products: Product[] = [];
  loading = false;
  error = '';

  ngOnInit(): void {
    this.sale = this.data.sale;
    this.resetState();
    this.loadProducts();
  }

  save(data: CreateRetailSalePayload): void {
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
