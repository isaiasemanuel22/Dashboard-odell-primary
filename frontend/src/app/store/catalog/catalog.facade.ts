import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { filter, map, Observable, take, combineLatest, switchMap, of, throwError } from 'rxjs';
import { Category, Customer, Product, ProductType, ReferenceData } from '../../core/models';
import { CatalogActions } from './catalog.actions';
import {
  selectCatalogError,
  selectCatalogLoaded,
  selectCatalogLoading,
  selectCategories,
  selectCategoriesByType,
  selectCustomers,
  selectProductById,
  selectProducts,
} from './catalog.selectors';

@Injectable({ providedIn: 'root' })
export class CatalogFacade {
  private readonly store = inject(Store);

  readonly products$ = this.store.select(selectProducts);
  readonly customers$ = this.store.select(selectCustomers);
  readonly categories$ = this.store.select(selectCategories);
  readonly loaded$ = this.store.select(selectCatalogLoaded);
  readonly loading$ = this.store.select(selectCatalogLoading);
  readonly error$ = this.store.select(selectCatalogError);

  load(refresh = false): void {
    this.store.dispatch(CatalogActions.load({ refresh }));
  }

  /** Emite una vez cuando el catálogo está listo (compatible con forkJoin). */
  private waitForLoaded<T>(data$: Observable<T>, refresh = false): Observable<T> {
    this.load(refresh);
    return combineLatest([data$, this.loaded$, this.error$]).pipe(
      filter(([, loaded, error]) => loaded || error !== null),
      take(1),
      switchMap(([data, , error]) =>
        error ? throwError(() => new Error(error)) : of(data),
      ),
    );
  }

  getProductsOnce(refresh = false): Observable<Product[]> {
    return this.waitForLoaded(this.products$, refresh);
  }

  getCustomersOnce(refresh = false): Observable<Customer[]> {
    return this.waitForLoaded(this.customers$, refresh);
  }

  getCategoriesOnce(
    refresh = false,
    type?: ProductType,
  ): Observable<Category[]> {
    return this.waitForLoaded(
      type ? this.store.select(selectCategoriesByType(type)) : this.categories$,
      refresh,
    );
  }

  ensureLoaded(refresh = false): Observable<ReferenceData> {
    return this.getProductsOnce(refresh).pipe(
      switchMap((products) =>
        combineLatest([this.customers$, this.categories$]).pipe(
          take(1),
          map(([customers, categories]) => ({
            products,
            customers,
            categories,
          })),
        ),
      ),
    );
  }

  products(): Observable<Product[]> {
    return this.products$;
  }

  customers(): Observable<Customer[]> {
    return this.customers$;
  }

  categories(type?: ProductType): Observable<Category[]> {
    return this.store.select(selectCategoriesByType(type));
  }

  productById(id: string): Observable<Product | null> {
    return this.store.select(selectProductById(id));
  }

  upsertProduct(product: Product): void {
    this.store.dispatch(CatalogActions.upsertProduct({ product }));
  }

  removeProduct(id: string): void {
    this.store.dispatch(CatalogActions.removeProduct({ id }));
  }

  upsertCustomer(customer: Customer): void {
    this.store.dispatch(CatalogActions.upsertCustomer({ customer }));
  }

  removeCustomer(id: string): void {
    this.store.dispatch(CatalogActions.removeCustomer({ id }));
  }

  upsertCategory(category: Category): void {
    this.store.dispatch(CatalogActions.upsertCategory({ category }));
  }

  removeCategory(id: string): void {
    this.store.dispatch(CatalogActions.removeCategory({ id }));
  }

  invalidate(): void {
    this.store.dispatch(CatalogActions.invalidate());
  }
}
