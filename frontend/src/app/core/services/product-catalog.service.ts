import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay } from 'rxjs';
import { Product } from '../models';
import { ProductsService } from './products.service';
import { removeById, upsertById } from '../utils/replace-in-store';

@Injectable({ providedIn: 'root' })
export class ProductCatalogService {
  private readonly productsService = inject(ProductsService);
  private cache$: Observable<Product[]> | null = null;
  private snapshot: Product[] = [];

  /** Catálogo completo (publicados + internos), cacheado en memoria. */
  getAllProducts(refresh = false): Observable<Product[]> {
    if (refresh) {
      this.cache$ = null;
    }
    if (!this.cache$) {
      this.cache$ = this.productsService
        .getProducts(undefined, { all: true })
        .pipe(shareReplay(1));
      this.cache$.subscribe((products) => {
        this.snapshot = products;
      });
    }
    return this.cache$;
  }

  seed(products: Product[]): void {
    this.snapshot = [...products];
    this.cache$ = of(this.snapshot).pipe(shareReplay(1));
  }

  upsert(product: Product): void {
    this.snapshot = upsertById(this.snapshot, product);
    this.cache$ = of([...this.snapshot]).pipe(shareReplay(1));
  }

  remove(id: string): void {
    this.snapshot = removeById(this.snapshot, id);
    this.cache$ = of([...this.snapshot]).pipe(shareReplay(1));
  }

  invalidate(): void {
    this.cache$ = null;
    this.snapshot = [];
  }
}
