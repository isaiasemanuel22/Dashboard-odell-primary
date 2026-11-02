import { Injectable } from '@angular/core';
import { ProductType } from '../../core/models';

export type ProductsMobileListFilter =
  | 'all'
  | 'below_margin'
  | 'fixed_price'
  | 'in_stock';

export type ProductsMobileTypeFilter = ProductType | 'all';

export interface ProductsMobileListState {
  listFilter: ProductsMobileListFilter;
  typeFilter: ProductsMobileTypeFilter;
  categoryFilter: string;
  search: string;
  scrollY: number;
}

@Injectable({ providedIn: 'root' })
export class ProductsMobileStateService {
  private state: ProductsMobileListState | null = null;

  save(next: ProductsMobileListState): void {
    this.state = {
      listFilter: next.listFilter,
      typeFilter: next.typeFilter,
      categoryFilter: next.categoryFilter,
      search: next.search,
      scrollY: next.scrollY,
    };
  }

  read(): ProductsMobileListState | null {
    if (!this.state) return null;
    return { ...this.state };
  }
}
