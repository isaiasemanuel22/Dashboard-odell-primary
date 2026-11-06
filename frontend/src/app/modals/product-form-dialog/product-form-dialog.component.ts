import {
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
import { filter } from 'rxjs';
import {
  CreateProductPayload,
  Product,
  UpdateProductPayload,
} from '../../core/models';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { ProductsService } from '../../core/services/products.service';
import { FormDialogShellComponent } from '../form-dialog-shell/form-dialog-shell.component';
import { MobileFormShellComponent } from '../../components/mobile-form-shell/mobile-form-shell.component';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { ProductFormComponent } from '../../pages/products/product-form/product-form.component';
import { FormDialogService } from '../form-dialog.service';

export interface ProductFormDialogData {
  product: Product | null;
}

@Component({
  standalone: true,
  imports: [
    FormDialogShellComponent,
    MobileFormShellComponent,
    ProductFormComponent,
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
        <db-mobile-form-shell [title]="dialogTitle" (close)="cancel()">
          <app-product-form
            [product]="product"
            [loading]="loading"
            [error]="error"
            (save)="save($event)"
            (cancel)="cancel()"
          />
        </db-mobile-form-shell>
      } @else {
        <app-product-form
          [product]="product"
          [loading]="loading"
          [error]="error"
          (save)="save($event)"
          (cancel)="cancel()"
        />
      }
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormDialogComponent implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(DialogRef<Product>);
  private readonly data = inject<ProductFormDialogData>(DIALOG_DATA);
  private readonly breakpoint = inject(BreakpointService);

  @ViewChild(ProductFormComponent) private form?: ProductFormComponent;

  readonly isMobile = this.breakpoint.isMobile;

  product: Product | null = null;
  loading = false;
  error = '';
  private closing = false;
  private confirmingDiscard = false;

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
        this.closing = true;
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
    if (this.closing || this.confirmingDiscard) return;

    const discard = (): void => {
      this.closing = true;
      this.dialogRef.close();
    };

    if (!this.form?.hasUnsavedChanges()) {
      discard();
      return;
    }

    this.confirmingDiscard = true;
    this.formDialogs
      .openConfirm({
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar. ¿Descartar el producto y cerrar?',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        this.confirmingDiscard = false;
        if (confirmed) discard();
      });
  }

  private resetState(): void {
    this.loading = false;
    this.error = '';
    this.cdr.markForCheck();
  }
}
