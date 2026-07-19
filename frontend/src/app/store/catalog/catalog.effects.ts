import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, filter, map, of, withLatestFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReferenceData } from '../../core/models';
import { CatalogActions } from './catalog.actions';
import { selectCatalogLoaded } from './catalog.selectors';

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
}
