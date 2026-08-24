import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Product } from '../models';
import { CatalogFacade } from '../../store/catalog/catalog.facade';

@Injectable({ providedIn: 'root' })
export class ProductCatalogService {
  private readonly catalogFacade = inject(CatalogFacade);

  loadProducts(options: { all?: boolean; refresh?: boolean } = {}): void {
    this.catalogFacade.loadProducts(options);
  }

  loadAllProducts(refresh = false): void {
    this.catalogFacade.loadAllProducts(refresh);
  }

  getAllProductsOnce(refresh = false): Observable<Product[]> {
    return this.catalogFacade.getAllProductsOnce(refresh);
  }

  /** Catálogo completo (incluye no publicados) para formularios y pickers. */
  getAllProducts(refresh = false): Observable<Product[]> {
    return this.catalogFacade.getAllProductsOnce(refresh);
  }

  /** Listado según último GET /products del store (puede estar filtrado). */
  getListProducts(refresh = false): Observable<Product[]> {
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

  refreshAfterCreate(): void {
    this.catalogFacade.productCreated();
  }

  remove(id: string): void {
    this.catalogFacade.removeProduct(id);
  }

  invalidate(): void {
    this.catalogFacade.invalidate();
  }
}
