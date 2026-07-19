import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest, filter, map, Observable, of, switchMap, take, throwError } from 'rxjs';
import { GeneralSettings } from '../../core/models';
import { SettingsActions } from './settings.actions';
import {
  selectGeneralSettings,
  selectProfitMargins,
  selectSettingsError,
  selectSettingsLoaded,
  selectSettingsLoading,
} from './settings.selectors';

@Injectable({ providedIn: 'root' })
export class SettingsFacade {
  private readonly store = inject(Store);

  readonly generalSettings$ = this.store.select(selectGeneralSettings);
  readonly profitMargins$ = this.store.select(selectProfitMargins);
  readonly loaded$ = this.store.select(selectSettingsLoaded);
  readonly loading$ = this.store.select(selectSettingsLoading);

  private readonly generalSettingsSignal = this.store.selectSignal(
    selectGeneralSettings,
  );

  load(refresh = false): void {
    this.store.dispatch(SettingsActions.load({ refresh }));
  }

  ensureLoaded(refresh = false): Observable<GeneralSettings> {
    const cached = this.peekGeneralSettings();
    if (cached && !refresh) {
      return of(cached);
    }

    this.load(refresh);
    return combineLatest([
      this.generalSettings$,
      this.loading$,
      this.store.select(selectSettingsError),
    ]).pipe(
      filter(([settings, loading, error]) => {
        if (error) return true;
        return settings !== null && !loading;
      }),
      take(1),
      switchMap(([settings, , error]) =>
        error
          ? throwError(() => new Error(error))
          : of(settings as GeneralSettings),
      ),
    );
  }

  watchGeneralSettings(): Observable<GeneralSettings | null> {
    return this.generalSettings$;
  }

  peekGeneralSettings(): GeneralSettings | null {
    return this.generalSettingsSignal();
  }

  setGeneral(settings: GeneralSettings): void {
    this.store.dispatch(SettingsActions.setGeneral({ settings }));
  }

  invalidate(): void {
    this.store.dispatch(SettingsActions.invalidate());
  }
}
