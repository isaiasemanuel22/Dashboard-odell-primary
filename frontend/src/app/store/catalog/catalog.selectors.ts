import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ProductType } from '../../core/models';
import {
  categoriesAdapter,
  CatalogState,
  customersAdapter,
  productsAdapter,
} from './catalog.reducer';

export const selectCatalogState =
  createFeatureSelector<CatalogState>('catalog');

const {
  selectAll: selectAllListProducts,
} = productsAdapter.getSelectors();

const {
  selectAll: selectAllCustomers,
} = customersAdapter.getSelectors();

const {
  selectAll: selectAllCategories,
} = categoriesAdapter.getSelectors();

export const selectCatalogLoaded = createSelector(
  selectCatalogState,
  (state) => state.loaded,
);

export const selectCatalogLoading = createSelector(
  selectCatalogState,
  (state) => state.loading,
);

export const selectCatalogError = createSelector(
  selectCatalogState,
  (state) => state.error,
);

export const selectProducts = createSelector(selectCatalogState, (state) =>
  selectAllListProducts(state.products),
);

export const selectAllCatalogProducts = createSelector(
  selectCatalogState,
  (state) => selectAllListProducts(state.allProducts),
);

export const selectAllProductsLoaded = createSelector(
  selectCatalogState,
  (state) => state.allProductsLoaded,
);

export const selectAllProductsLoading = createSelector(
  selectCatalogState,
  (state) => state.allProductsLoading,
);

export const selectCustomers = createSelector(selectCatalogState, (state) =>
  selectAllCustomers(state.customers),
);

export const selectCategories = createSelector(selectCatalogState, (state) =>
  selectAllCategories(state.categories),
);

export const selectProductById = (id: string) =>
  createSelector(selectCatalogState, (state) => {
    const allEntities = productsAdapter.getSelectors().selectEntities(
      state.allProducts,
    );
    const listEntities = productsAdapter.getSelectors().selectEntities(
      state.products,
    );
    return allEntities[id] ?? listEntities[id] ?? null;
  });

export const selectCategoriesByType = (type?: ProductType) =>
  createSelector(selectCategories, (categories) =>
    type
      ? categories.filter((category) => category.productTypes.includes(type))
      : categories,
  );
