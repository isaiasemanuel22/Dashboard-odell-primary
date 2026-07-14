import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay } from 'rxjs';
import { Category, ProductType } from '../models';
import { ProductsService } from './products.service';
import { removeById, upsertById } from '../utils/replace-in-store';

@Injectable({ providedIn: 'root' })
export class CategoryCatalogService {
  private readonly productsService = inject(ProductsService);
  private cache$: Observable<Category[]> | null = null;
  private snapshot: Category[] = [];

  getCategories(refresh = false, type?: ProductType): Observable<Category[]> {
    if (type) {
      return this.productsService.getCategories(type);
    }

    if (refresh) {
      this.cache$ = null;
    }
    if (!this.cache$) {
      this.cache$ = this.productsService.getCategories().pipe(shareReplay(1));
      this.cache$.subscribe((categories) => {
        this.snapshot = categories;
      });
    }
    return this.cache$;
  }

  seed(categories: Category[]): void {
    this.snapshot = [...categories];
    this.cache$ = of(this.snapshot).pipe(shareReplay(1));
  }

  upsert(category: Category): void {
    this.snapshot = upsertById(this.snapshot, category);
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
