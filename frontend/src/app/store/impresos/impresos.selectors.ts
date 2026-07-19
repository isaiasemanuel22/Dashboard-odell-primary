import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PaperType } from '../../core/models';
import { impresosAdapter, ImpresosState } from './impresos.reducer';

export const selectImpresosState =
  createFeatureSelector<ImpresosState>('impresos');

const { selectAll: selectAllImpresos } = impresosAdapter.getSelectors();

export const selectImpresosLoaded = createSelector(
  selectImpresosState,
  (state) => state.loaded,
);

export const selectImpresosLoading = createSelector(
  selectImpresosState,
  (state) => state.loading,
);

export const selectImpresos = createSelector(selectImpresosState, (state) =>
  selectAllImpresos(state.items),
);

export const selectImpresosByPaperType = (paperType?: PaperType) =>
  createSelector(selectImpresos, (impresos) =>
    paperType
      ? impresos.filter((item) => item.paperType === paperType)
      : impresos,
  );
