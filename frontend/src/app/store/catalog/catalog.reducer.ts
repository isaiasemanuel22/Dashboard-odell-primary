import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Category, Customer, Product } from '../../core/models';
import { CatalogActions } from './catalog.actions';

export const productsAdapter = createEntityAdapter<Product>();
export const customersAdapter = createEntityAdapter<Customer>();
export const categoriesAdapter = createEntityAdapter<Category>();

export interface CatalogState {
  products: EntityState<Product>;
  customers: EntityState<Customer>;
  categories: EntityState<Category>;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

export const initialCatalogState: CatalogState = {
  products: productsAdapter.getInitialState(),
  customers: customersAdapter.getInitialState(),
  categories: categoriesAdapter.getInitialState(),
  loaded: false,
  loading: false,
  error: null,
};

export const catalogReducer = createReducer(
  initialCatalogState,
  on(CatalogActions.load, (state, { refresh }) => ({
    ...state,
    loading: refresh === true || !state.loaded,
    error: null,
  })),
  on(CatalogActions.loadSuccess, (state, { data }) => ({
    ...state,
    products: productsAdapter.setAll(data.products, state.products),
    customers: customersAdapter.setAll(data.customers, state.customers),
    categories: categoriesAdapter.setAll(data.categories, state.categories),
    loaded: true,
    loading: false,
    error: null,
  })),
  on(CatalogActions.loadFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(CatalogActions.upsertProduct, (state, { product }) => ({
    ...state,
    products: productsAdapter.upsertOne(product, state.products),
  })),
  on(CatalogActions.removeProduct, (state, { id }) => ({
    ...state,
    products: productsAdapter.removeOne(id, state.products),
  })),
  on(CatalogActions.upsertCustomer, (state, { customer }) => ({
    ...state,
    customers: customersAdapter.upsertOne(customer, state.customers),
  })),
  on(CatalogActions.removeCustomer, (state, { id }) => ({
    ...state,
    customers: customersAdapter.removeOne(id, state.customers),
  })),
  on(CatalogActions.upsertCategory, (state, { category }) => ({
    ...state,
    categories: categoriesAdapter.upsertOne(category, state.categories),
  })),
  on(CatalogActions.removeCategory, (state, { id }) => ({
    ...state,
    categories: categoriesAdapter.removeOne(id, state.categories),
  })),
  on(CatalogActions.invalidate, () => initialCatalogState),
);
