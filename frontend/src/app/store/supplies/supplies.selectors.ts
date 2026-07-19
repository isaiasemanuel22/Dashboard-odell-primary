import { createFeatureSelector, createSelector } from '@ngrx/store';
import { SupplyCategory, SupplyType } from '../../core/models';
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
  type?: SupplyType;
  category?: SupplyCategory;
}) =>
  createSelector(selectSupplies, (supplies) => {
    let result = supplies;
    if (options?.type) {
      result = result.filter((supply) => supply.type === options.type);
    }
    if (options?.category) {
      result = result.filter((supply) => supply.category === options.category);
    }
    return result;
  });
