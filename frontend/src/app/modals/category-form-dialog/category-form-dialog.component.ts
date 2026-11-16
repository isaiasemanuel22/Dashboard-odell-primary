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
import { Category, ProductType } from '../../core/models';
import { CategoryCatalogService } from '../../core/services/category-catalog.service';
import { ProductsService } from '../../core/services/products.service';
import { FormDialogShellComponent } from '../form-dialog-shell/form-dialog-shell.component';
import { confirmMobileFormDiscard } from '../../components/mobile-form-shell/confirm-mobile-form-discard';
import { FormDialogService } from '../form-dialog.service';
import { guardDialogDismiss } from '../dialog-dismiss-guard';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { CategoryFormComponent } from '../../pages/products/category-form/category-form.component';

export interface CategoryFormDialogData {
  presetProductType?: ProductType;
  /** Categoría a editar (renombrar / cambiar tipos). */
  category?: Category | null;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, CategoryFormComponent],
  template: `
    <app-form-dialog-shell
      [title]="category ? 'Editar categoría' : 'Nueva categoría'"
      subtitle="Agrupa productos en el catálogo y en los filtros"
      size="md"
      [footerBar]="true"
      (close)="cancel()"
    >
      <app-category-form
        #categoryForm
        [category]="category"
        [loading]="loading"
        [error]="error"
        [presetProductType]="presetProductType"
        (save)="save($event)"
        (cancel)="cancel()"
      />
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFormDialogComponent implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly categoryCatalog = inject(CategoryCatalogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<Category>);
  private readonly data = inject<CategoryFormDialogData>(DIALOG_DATA);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('categoryForm') categoryForm?: CategoryFormComponent;

  category: Category | null = null;
  private confirmingDiscard = false;

  presetProductType?: ProductType;
  loading = false;
  error = '';

  ngOnInit(): void {
    this.presetProductType = this.data.presetProductType;
    this.category = this.data.category ?? null;
    guardDialogDismiss(this.dialogRef, this.destroyRef, () => this.cancel());
  }

  save(data: { name: string; productTypes: ProductType[] }): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const request = this.category
      ? this.productsService.updateCategory(this.category.id, data)
      : this.productsService.createCategory(data);
    request.subscribe({
      next: (category) => {
        this.loading = false;
        this.categoryCatalog.upsert(category);
        this.dialogRef.close(category);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'Error al guardar la categoría');
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    confirmMobileFormDiscard(this.formDialogs, {
      hasChanges: !!this.categoryForm?.hasUnsavedChanges(),
      entityLabel: 'la categoría',
    }).subscribe((confirmed) => {
      this.confirmingDiscard = false;
      if (confirmed) this.dialogRef.close();
    });
  }
}
