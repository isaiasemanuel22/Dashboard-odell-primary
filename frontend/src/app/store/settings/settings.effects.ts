import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, filter, map, of, withLatestFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GeneralSettings } from '../../core/models';
import { SettingsActions } from './settings.actions';
import { selectSettingsLoaded } from './settings.selectors';

@Injectable()
export class SettingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);

  readonly load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.load),
      withLatestFrom(this.store.select(selectSettingsLoaded)),
      filter(([action, loaded]) => Boolean(action.refresh) || !loaded),
      exhaustMap(() =>
        this.http
          .get<GeneralSettings>(`${environment.apiUrl}/settings/general`)
          .pipe(
            map((settings) => SettingsActions.loadSuccess({ settings })),
            catchError((error: unknown) =>
              of(
                SettingsActions.loadFailure({
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Error al cargar ajustes',
                }),
              ),
            ),
          ),
      ),
    ),
  );
}
