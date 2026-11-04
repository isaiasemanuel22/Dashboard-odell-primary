import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, filter, map, of, switchMap, withLatestFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supply } from '../../core/models';
import { PrintJobsService } from '../../core/services/print-jobs.service';
import { SuppliesActions } from './supplies.actions';
import { selectSuppliesLoaded } from './supplies.selectors';

@Injectable()
export class SuppliesEffects {
  private readonly actions$ = inject(Actions);
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);
  private readonly printJobs = inject(PrintJobsService);

  /** Al cargar el store, las tareas de Por hacer y En progreso que necesitan un insumo en 0 pasan a bloqueadas. */
  readonly blockTasksOnSupplyLoad$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(SuppliesActions.loadSuccess),
        switchMap(() =>
          this.printJobs.blockTasksMissingSupplies().pipe(
            catchError(() => of(null)),
          ),
        ),
      ),
    { dispatch: false },
  );

  /** Al guardar un insumo en 0, se bloquean las tareas que lo necesitan. */
  readonly blockTasksOnSupplyEmpty$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(SuppliesActions.upsertSupply),
        filter(({ supply }) => Number(supply.quantity) <= 0),
        switchMap(() =>
          this.printJobs.blockTasksMissingSupplies().pipe(
            catchError(() => of(null)),
          ),
        ),
      ),
    { dispatch: false },
  );

  readonly load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SuppliesActions.load),
      withLatestFrom(this.store.select(selectSuppliesLoaded)),
      filter(([action, loaded]) => Boolean(action.refresh) || !loaded),
      switchMap(() =>
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
