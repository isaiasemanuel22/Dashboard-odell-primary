import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  CreateProductPayload,
  Product,
  UpdateProductPayload,
} from '../../core/models';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { ProductsService } from '../../core/services/products.service';
import { FormDialogShellComponent } from '../form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { ProductFormComponent } from '../../pages/products/product-form/product-form.component';

export interface ProductFormDialogData {
  product: Product | null;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, ProductFormComponent],
  template: `
    <app-form-dialog-shell
      [title]="dialogTitle"
      [subtitle]="dialogSubtitle"
      size="xl"
      [stickyHeader]="true"
      (close)="cancel()"
    >
      @if (isMobile()) {
        <header class="order-dialog-m-bar">
          <button
            type="button"
            class="m-ib"
            aria-label="Cerrar sin guardar"
            (click)="cancel()"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <h2 class="order-dialog-m-bar__title">{{ dialogTitle }}</h2>
        </header>
      }
      <app-product-form
        [product]="product"
        [loading]="loading"
        [error]="error"
        (save)="save($event)"
        (cancel)="cancel()"
      />
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormDialogComponent implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<Product>);
  private readonly data = inject<ProductFormDialogData>(DIALOG_DATA);
  private readonly breakpoint = inject(BreakpointService);

  readonly isMobile = this.breakpoint.isMobile;

  product: Product | null = null;
  loading = false;
  error = '';

  get dialogTitle(): string {
    return this.product ? 'Editar producto' : 'Nuevo producto';
  }

  get dialogSubtitle(): string {
    return this.isMobile()
      ? ''
      : 'El precio se calcula solo a medida que cargás material y tiempos';
  }

  ngOnInit(): void {
    this.product = this.data.product;
    this.resetState();
  }

  save(payload: CreateProductPayload | UpdateProductPayload): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const request = this.product
      ? this.productsService.updateProduct(this.product.id, payload)
      : this.productsService.createProduct(payload as CreateProductPayload);

    request.subscribe({
      next: (saved) => {
        this.loading = false;
        this.dialogRef.close(saved);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'Error al guardar el producto');
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private resetState(): void {
    this.loading = false;
    this.error = '';
    this.cdr.markForCheck();
  }
}
