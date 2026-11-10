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
import { confirmMobileFormDiscard } from '../../components/mobile-form-shell/confirm-mobile-form-discard';
import type { MobileDockAction } from '../../components/mobile-dock/mobile-dock.component';
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
        <db-mobile-form-shell
          [title]="dialogTitle"
          [dockActions]="mobileDockActions"
          [dockSecondaryFixed]="true"
          discardEntityLabel="el producto"
          [isDirty]="!!form?.hasUnsavedChanges()"
          (close)="forceClose()"
          (dockAction)="onMobileDockAction($event)"
        >
          <app-product-form
            [product]="product"
            [loading]="loading"
            [error]="error"
            [hideFooter]="true"
            (save)="save($event)"
            (cancel)="cancel()"
          />
          @if (form?.show3mfFooterHint) {
            <p dockHint class="product-form-dialog__dock-hint">
              El .3mf queda adjunto al producto para reimprimir
            </p>
          }
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
  styles: [
    `
      .product-form-dialog__dock-hint {
        margin: 0;
        text-align: center;
        font-size: 12px;
        color: #5b7083;
      }
    `,
  ],
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

  @ViewChild(ProductFormComponent) form?: ProductFormComponent;
  @ViewChild(MobileFormShellComponent)
  private mobileShell?: MobileFormShellComponent;

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

  get mobileDockActions(): MobileDockAction[] {
    const form = this.form;
    const facade = form?.facade;
    const savingFiles = !!(
      facade?.savingImages || facade?.savingAttachments
    );
    const canSave =
      !!facade?.form.controls.name.value.trim() &&
      (facade?.categoryIds.length ?? 0) >= 1;
    return [
      {
        id: 'cancel',
        label: 'Cancelar',
        kind: 'secondary',
        disabled: this.loading || savingFiles,
      },
      {
        id: 'save',
        label: savingFiles
          ? 'Subiendo archivos...'
          : this.loading
            ? 'Guardando...'
            : this.product
              ? 'Guardar'
              : 'Crear producto',
        kind: 'primary',
        disabled: this.loading || savingFiles || !canSave,
        loading: this.loading || savingFiles,
      },
    ];
  }

  onMobileDockAction(id: string): void {
    if (id === 'cancel') {
      this.cancel();
      return;
    }
    if (id === 'save') {
      void this.form?.onSubmit();
    }
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
      entityLabel: 'el producto',
    }).subscribe((confirmed) => {
      this.confirmingDiscard = false;
      if (confirmed) this.forceClose();
    });
  }

  private resetState(): void {
    this.loading = false;
    this.error = '';
    this.cdr.markForCheck();
  }
}
