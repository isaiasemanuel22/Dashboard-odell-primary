import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Category, Product, ProductType } from '../../core/models';
import { DbButtonComponent } from '@general-components';

export type ProductSheetTypeFilter = ProductType | 'all';

export interface ProductMobileSheetFilters {
  typeFilter: ProductSheetTypeFilter;
  categoryFilter: string;
}

export interface ProductFiltersSheetData {
  filters: ProductMobileSheetFilters;
  typeFilters: { value: ProductSheetTypeFilter; label: string }[];
  categories: Category[];
  /** Lista ya acotada (chip + búsqueda) para el contador en vivo. */
  products: Product[];
}

@Component({
  standalone: true,
  imports: [DbButtonComponent],
  templateUrl: './product-filters-sheet.component.html',
  styleUrl: './product-filters-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFiltersSheetComponent {
  private readonly data = inject<ProductFiltersSheetData>(DIALOG_DATA);
  private readonly dialogRef =
    inject<DialogRef<ProductMobileSheetFilters | undefined>>(DialogRef);
  private readonly cdr = inject(ChangeDetectorRef);

  draft: ProductMobileSheetFilters = cloneFilters(this.data.filters);
  readonly categories: Category[] = [...this.data.categories];

  readonly typeFilters = this.data.typeFilters;

  get categoryOptions(): { value: string; label: string }[] {
    const visible =
      this.draft.typeFilter === 'all'
        ? this.categories
        : this.categories.filter((cat) =>
            cat.productTypes.includes(this.draft.typeFilter as ProductType),
          );
    return [
      { value: 'all', label: 'Todas' },
      ...visible.map((cat) => ({ value: cat.id, label: cat.name })),
    ];
  }

  get matchCount(): number {
    return this.data.products.filter((product) =>
      matchesProductSheetFilters(product, this.draft),
    ).length;
  }

  get applyLabel(): string {
    const n = this.matchCount;
    return n === 1 ? 'Ver 1 producto' : `Ver ${n} productos`;
  }

  setType(value: ProductSheetTypeFilter): void {
    this.draft = { ...this.draft, typeFilter: value };
    if (
      this.draft.categoryFilter !== 'all' &&
      !this.categoryOptions.some((opt) => opt.value === this.draft.categoryFilter)
    ) {
      this.draft = { ...this.draft, categoryFilter: 'all' };
    }
    this.cdr.markForCheck();
  }

  setCategory(value: string): void {
    this.draft = { ...this.draft, categoryFilter: value };
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.draft = emptyProductMobileSheetFilters();
    this.cdr.markForCheck();
  }

  apply(): void {
    this.dialogRef.close(cloneFilters(this.draft));
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}

export function emptyProductMobileSheetFilters(): ProductMobileSheetFilters {
  return { typeFilter: 'all', categoryFilter: 'all' };
}

export function countProductMobileSheetFilters(
  filters: ProductMobileSheetFilters,
): number {
  let n = 0;
  if (filters.typeFilter !== 'all') n += 1;
  if (filters.categoryFilter !== 'all') n += 1;
  return n;
}

export function matchesProductSheetFilters(
  product: Product,
  filters: ProductMobileSheetFilters,
): boolean {
  const matchesType =
    filters.typeFilter === 'all' || product.type === filters.typeFilter;
  const matchesCategory =
    filters.categoryFilter === 'all' ||
    product.categoryIds.includes(filters.categoryFilter);
  return matchesType && matchesCategory;
}

function cloneFilters(
  filters: ProductMobileSheetFilters,
): ProductMobileSheetFilters {
  return {
    typeFilter: filters.typeFilter,
    categoryFilter: filters.categoryFilter,
  };
}
