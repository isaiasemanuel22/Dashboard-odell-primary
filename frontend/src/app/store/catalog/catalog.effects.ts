import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, filter, map, mergeMap, of, withLatestFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product, ReferenceData } from '../../core/models';
import { CatalogActions } from './catalog.actions';
import { selectAllProductsLoaded, selectCatalogLoaded } from './catalog.selectors';

@Injectable()
export class CatalogEffects {
  private readonly actions$ = inject(Actions);
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);

  readonly load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CatalogActions.load),
      withLatestFrom(this.store.select(selectCatalogLoaded)),
      filter(([action, loaded]) => Boolean(action.refresh) || !loaded),
      exhaustMap(() =>
        this.http
          .get<ReferenceData>(`${environment.apiUrl}/reference-data`)
          .pipe(
            map((data) => CatalogActions.loadSuccess({ data })),
            catchError((error: unknown) =>
              of(
                CatalogActions.loadFailure({
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Error al cargar catálogo',
                }),
              ),
            ),
          ),
      ),
    ),
  );

  readonly loadProducts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CatalogActions.loadProducts),
      exhaustMap(({ all }) => {
        let params = new HttpParams();
        if (all) {
          params = params.set('all', 'true');
        }

        return this.http
          .get<Product[]>(`${environment.apiUrl}/products`, { params })
          .pipe(
            map((products) => CatalogActions.loadProductsSuccess({ products })),
            catchError((error: unknown) =>
              of(
                CatalogActions.loadProductsFailure({
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Error al cargar productos',
                }),
              ),
            ),
          );
      }),
    ),
  );

  readonly loadAllProducts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CatalogActions.loadAllProducts),
      withLatestFrom(this.store.select(selectAllProductsLoaded)),
      filter(([action, loaded]) => Boolean(action.refresh) || !loaded),
      exhaustMap(() =>
        this.http
          .get<Product[]>(`${environment.apiUrl}/products`, {
            params: new HttpParams().set('all', 'true'),
          })
          .pipe(
            map((products) =>
              CatalogActions.loadAllProductsSuccess({ products }),
            ),
            catchError((error: unknown) =>
              of(
                CatalogActions.loadAllProductsFailure({
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Error al cargar catálogo completo',
                }),
              ),
            ),
          ),
      ),
    ),
  );

  readonly reloadAfterProductCreated$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CatalogActions.productCreated),
      mergeMap(() => [
        CatalogActions.loadProducts({ all: true, refresh: true }),
        CatalogActions.loadAllProducts({ refresh: true }),
      ]),
    ),
  );
}
