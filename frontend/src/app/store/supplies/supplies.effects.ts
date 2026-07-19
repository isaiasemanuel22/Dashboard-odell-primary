import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, filter, map, of, withLatestFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supply } from '../../core/models';
import { SuppliesActions } from './supplies.actions';
import { selectSuppliesLoaded } from './supplies.selectors';

@Injectable()
export class SuppliesEffects {
  private readonly actions$ = inject(Actions);
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);

  readonly load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SuppliesActions.load),
      withLatestFrom(this.store.select(selectSuppliesLoaded)),
      filter(([action, loaded]) => Boolean(action.refresh) || !loaded),
      exhaustMap(() =>
        this.http.get<Supply[]>(`${environment.apiUrl}/supplies`).pipe(
          map((supplies) => SuppliesActions.loadSuccess({ supplies })),
          catchError((error: unknown) =>
            of(
              SuppliesActions.loadFailure({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Error al cargar insumos',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
