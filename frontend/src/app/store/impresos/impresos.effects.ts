import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, filter, map, of, withLatestFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ImpresoWithCost } from '../../core/models';
import { ImpresosActions } from './impresos.actions';
import { selectImpresosLoaded } from './impresos.selectors';

@Injectable()
export class ImpresosEffects {
  private readonly actions$ = inject(Actions);
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);

  readonly load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ImpresosActions.load),
      withLatestFrom(this.store.select(selectImpresosLoaded)),
      filter(([action, loaded]) => Boolean(action.refresh) || !loaded),
      exhaustMap(() =>
        this.http
          .get<ImpresoWithCost[]>(`${environment.apiUrl}/impresos`)
          .pipe(
            map((impresos) => ImpresosActions.loadSuccess({ impresos })),
            catchError((error: unknown) =>
              of(
                ImpresosActions.loadFailure({
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Error al cargar impresos',
                }),
              ),
            ),
          ),
      ),
    ),
  );
}
