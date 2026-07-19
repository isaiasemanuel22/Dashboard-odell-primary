import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Supply } from '../../core/models';
import { SuppliesActions } from './supplies.actions';

export const suppliesAdapter = createEntityAdapter<Supply>();

export interface SuppliesState {
  items: EntityState<Supply>;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

export const initialSuppliesState: SuppliesState = {
  items: suppliesAdapter.getInitialState(),
  loaded: false,
  loading: false,
  error: null,
};

export const suppliesReducer = createReducer(
  initialSuppliesState,
  on(SuppliesActions.load, (state, { refresh }) => ({
    ...state,
    loading: refresh === true || !state.loaded,
    error: null,
  })),
  on(SuppliesActions.loadSuccess, (state, { supplies }) => ({
    ...state,
    items: suppliesAdapter.setAll(supplies, state.items),
    loaded: true,
    loading: false,
    error: null,
  })),
  on(SuppliesActions.loadFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(SuppliesActions.upsertSupply, (state, { supply }) => ({
    ...state,
    items: suppliesAdapter.upsertOne(supply, state.items),
  })),
  on(SuppliesActions.removeSupply, (state, { id }) => ({
    ...state,
    items: suppliesAdapter.removeOne(id, state.items),
  })),
  on(SuppliesActions.invalidate, () => initialSuppliesState),
);
