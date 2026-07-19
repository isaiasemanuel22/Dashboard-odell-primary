import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Product } from '../models';
import { CatalogFacade } from '../../store/catalog/catalog.facade';

@Injectable({ providedIn: 'root' })
export class ProductCatalogService {
  private readonly catalogFacade = inject(CatalogFacade);

  getAllProducts(refresh = false): Observable<Product[]> {
    return this.catalogFacade.getProductsOnce(refresh);
  }

  seed(products: Product[]): void {
    for (const product of products) {
      this.catalogFacade.upsertProduct(product);
    }
  }

  upsert(product: Product): void {
    this.catalogFacade.upsertProduct(product);
  }

  remove(id: string): void {
    this.catalogFacade.removeProduct(id);
  }

  invalidate(): void {
    this.catalogFacade.invalidate();
  }
}
