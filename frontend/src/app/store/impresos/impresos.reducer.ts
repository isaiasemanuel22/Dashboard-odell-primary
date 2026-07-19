import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { ImpresoWithCost } from '../../core/models';
import { ImpresosActions } from './impresos.actions';

export const impresosAdapter = createEntityAdapter<ImpresoWithCost>();

export interface ImpresosState {
  items: EntityState<ImpresoWithCost>;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

export const initialImpresosState: ImpresosState = {
  items: impresosAdapter.getInitialState(),
  loaded: false,
  loading: false,
  error: null,
};

export const impresosReducer = createReducer(
  initialImpresosState,
  on(ImpresosActions.load, (state, { refresh }) => ({
    ...state,
    loading: refresh === true || !state.loaded,
    error: null,
  })),
  on(ImpresosActions.loadSuccess, (state, { impresos }) => ({
    ...state,
    items: impresosAdapter.setAll(impresos, state.items),
    loaded: true,
    loading: false,
    error: null,
  })),
  on(ImpresosActions.loadFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(ImpresosActions.upsertImpreso, (state, { impreso }) => ({
    ...state,
    items: impresosAdapter.upsertOne(impreso, state.items),
  })),
  on(ImpresosActions.removeImpreso, (state, { id }) => ({
    ...state,
    items: impresosAdapter.removeOne(id, state.items),
  })),
  on(ImpresosActions.invalidate, () => initialImpresosState),
);
