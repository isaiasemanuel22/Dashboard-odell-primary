import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Category, ProductType } from '../models';
import { ProductsService } from './products.service';
import { CatalogFacade } from '../../store/catalog/catalog.facade';

@Injectable({ providedIn: 'root' })
export class CategoryCatalogService {
  private readonly productsService = inject(ProductsService);
  private readonly catalogFacade = inject(CatalogFacade);

  getCategories(refresh = false, type?: ProductType): Observable<Category[]> {
    if (type) {
      return this.productsService.getCategories(type);
    }

    return this.catalogFacade.getCategoriesOnce(refresh);
  }

  seed(categories: Category[]): void {
    for (const category of categories) {
      this.catalogFacade.upsertCategory(category);
    }
  }

  upsert(category: Category): void {
    this.catalogFacade.upsertCategory(category);
  }

  remove(id: string): void {
    this.catalogFacade.removeCategory(id);
  }

  invalidate(): void {
    this.catalogFacade.invalidate();
  }
}
