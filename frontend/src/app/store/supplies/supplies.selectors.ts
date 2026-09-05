import { createFeatureSelector, createSelector } from '@ngrx/store';
import { SupplyCategory } from '../../core/models';
import { suppliesAdapter, SuppliesState } from './supplies.reducer';

export const selectSuppliesState =
  createFeatureSelector<SuppliesState>('supplies');

const { selectAll: selectAllSupplies } = suppliesAdapter.getSelectors();

export const selectSuppliesLoaded = createSelector(
  selectSuppliesState,
  (state) => state.loaded,
);

export const selectSuppliesLoading = createSelector(
  selectSuppliesState,
  (state) => state.loading,
);

export const selectSupplies = createSelector(selectSuppliesState, (state) =>
  selectAllSupplies(state.items),
);

export const selectSuppliesFiltered = (options?: {
  category?: SupplyCategory;
}) =>
  createSelector(selectSupplies, (supplies) => {
    if (!options?.category) {
      return supplies;
    }
    return supplies.filter((supply) => supply.category === options.category);
  });
