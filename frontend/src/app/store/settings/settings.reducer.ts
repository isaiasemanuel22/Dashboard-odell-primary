import { createReducer, on } from '@ngrx/store';
import { GeneralSettings } from '../../core/models';
import { SettingsActions } from './settings.actions';

export interface SettingsState {
  general: GeneralSettings | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

export const initialSettingsState: SettingsState = {
  general: null,
  loaded: false,
  loading: false,
  error: null,
};

export const settingsReducer = createReducer(
  initialSettingsState,
  on(SettingsActions.load, (state, { refresh }) => ({
    ...state,
    loading: refresh === true || !state.loaded,
    error: null,
  })),
  on(SettingsActions.loadSuccess, (state, { settings }) => ({
    ...state,
    general: settings,
    loaded: true,
    loading: false,
    error: null,
  })),
  on(SettingsActions.loadFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(SettingsActions.setGeneral, (state, { settings }) => ({
    ...state,
    general: settings,
    loaded: true,
    loading: false,
    error: null,
  })),
  on(SettingsActions.invalidate, () => initialSettingsState),
);
