import { createFeatureSelector, createSelector } from '@ngrx/store';
import { SettingsState } from './settings.reducer';

export const selectSettingsState =
  createFeatureSelector<SettingsState>('settings');

export const selectGeneralSettings = createSelector(
  selectSettingsState,
  (state) => state.general,
);

export const selectSettingsLoaded = createSelector(
  selectSettingsState,
  (state) => state.loaded,
);

export const selectSettingsLoading = createSelector(
  selectSettingsState,
  (state) => state.loading,
);

export const selectSettingsError = createSelector(
  selectSettingsState,
  (state) => state.error,
);

export const selectProfitMargins = createSelector(
  selectGeneralSettings,
  (settings) => settings?.profitMargins ?? null,
);
