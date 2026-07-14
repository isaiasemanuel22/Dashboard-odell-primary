import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Category, ProductType } from '../../core/models';
import { CategoryCatalogService } from '../../core/services/category-catalog.service';
import { ProductsService } from '../../core/services/products.service';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../utils/api-error';
import { CategoryFormComponent } from '../../pages/products/category-form/category-form.component';

export interface CategoryFormDialogData {
  presetProductType?: ProductType;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, CategoryFormComponent],
  template: `
    <app-form-dialog-shell title="Nueva categoría" size="sm" (close)="cancel()">
      <app-category-form
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

  presetProductType?: ProductType;
  loading = false;
  error = '';

  ngOnInit(): void {
    this.presetProductType = this.data.presetProductType;
  }

  save(data: { name: string; productTypes: ProductType[] }): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    this.productsService.createCategory(data).subscribe({
      next: (category) => {
        this.loading = false;
        this.categoryCatalog.upsert(category);
        this.dialogRef.close(category);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'Error al crear la categoría');
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
