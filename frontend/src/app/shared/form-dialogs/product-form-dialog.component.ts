import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  Category,
  CreateProductPayload,
  Product,
  UpdateProductPayload,
} from '../../core/models';
import { CategoryCatalogService } from '../../core/services/category-catalog.service';
import { ProductCatalogService } from '../../core/services/product-catalog.service';
import { ProductsService } from '../../core/services/products.service';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../utils/api-error';
import { ProductFormComponent } from '../../pages/products/product-form/product-form.component';

export interface ProductFormDialogData {
  product: Product | null;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, ProductFormComponent],
  template: `
    <app-form-dialog-shell
      [title]="product ? 'Editar producto' : 'Nuevo producto'"
      size="lg"
      [stickyHeader]="true"
      (close)="cancel()"
    >
      <app-product-form
        [product]="product"
        [categories]="categories"
        [loading]="loading"
        [error]="error"
        (save)="save($event)"
        (cancel)="cancel()"
        (categoriesChange)="onCategoriesChange($event)"
      />
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormDialogComponent implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly productCatalog = inject(ProductCatalogService);
  private readonly categoryCatalog = inject(CategoryCatalogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<Product>);
  private readonly data = inject<ProductFormDialogData>(DIALOG_DATA);

  product: Product | null = null;
  categories: Category[] = [];
  loading = false;
  error = '';

  ngOnInit(): void {
    this.product = this.data.product;
    this.resetState();
    this.loadCategories();
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
        if (this.product) {
          this.productCatalog.upsert(saved);
        } else {
          this.productCatalog.refreshAfterCreate();
        }
        this.dialogRef.close(saved);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'Error al guardar el producto');
        this.cdr.markForCheck();
      },
    });
  }

  onCategoriesChange(categories: Category[]): void {
    this.categories = categories;
    this.cdr.markForCheck();
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private loadCategories(): void {
    this.categoryCatalog.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
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
