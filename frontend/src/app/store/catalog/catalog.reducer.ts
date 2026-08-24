import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Category, Customer, Product } from '../../core/models';
import { CatalogActions } from './catalog.actions';

export const productsAdapter = createEntityAdapter<Product>();
export const customersAdapter = createEntityAdapter<Customer>();
export const categoriesAdapter = createEntityAdapter<Category>();

export interface CatalogState {
  /** Listado de productos (GET /products según filtro del listado). */
  products: EntityState<Product>;
  /** Catálogo completo para formularios, piezas incluidas y pricing. */
  allProducts: EntityState<Product>;
  customers: EntityState<Customer>;
  categories: EntityState<Category>;
  loaded: boolean;
  loading: boolean;
  allProductsLoaded: boolean;
  allProductsLoading: boolean;
  error: string | null;
}

export const initialCatalogState: CatalogState = {
  products: productsAdapter.getInitialState(),
  allProducts: productsAdapter.getInitialState(),
  customers: customersAdapter.getInitialState(),
  categories: categoriesAdapter.getInitialState(),
  loaded: false,
  loading: false,
  allProductsLoaded: false,
  allProductsLoading: false,
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
    allProducts: productsAdapter.setAll(data.products, state.allProducts),
    customers: customersAdapter.setAll(data.customers, state.customers),
    categories: categoriesAdapter.setAll(data.categories, state.categories),
    loaded: true,
    allProductsLoaded: true,
    loading: false,
    allProductsLoading: false,
    error: null,
  })),
  on(CatalogActions.loadFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(CatalogActions.loadProducts, (state, { refresh }) => ({
    ...state,
    loading: refresh === true || !state.loaded,
    error: null,
  })),
  on(CatalogActions.loadProductsSuccess, (state, { products }) => ({
    ...state,
    products: productsAdapter.setAll(products, state.products),
    loaded: true,
    loading: false,
    error: null,
  })),
  on(CatalogActions.loadProductsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(CatalogActions.loadAllProducts, (state, { refresh }) => ({
    ...state,
    allProductsLoading: refresh === true || !state.allProductsLoaded,
    error: null,
  })),
  on(CatalogActions.loadAllProductsSuccess, (state, { products }) => ({
    ...state,
    allProducts: productsAdapter.setAll(products, state.allProducts),
    allProductsLoaded: true,
    allProductsLoading: false,
    error: null,
  })),
  on(CatalogActions.loadAllProductsFailure, (state, { error }) => ({
    ...state,
    allProductsLoading: false,
    error,
  })),
  on(CatalogActions.upsertProduct, (state, { product }) => ({
    ...state,
    products: productsAdapter.upsertOne(product, state.products),
    allProducts: productsAdapter.upsertOne(product, state.allProducts),
  })),
  on(CatalogActions.removeProduct, (state, { id }) => ({
    ...state,
    products: productsAdapter.removeOne(id, state.products),
    allProducts: productsAdapter.removeOne(id, state.allProducts),
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
  on(CatalogActions.applyPricingFields, (state, { fields }) => {
    if (!fields.length) return state;

    const changes = fields
      .map((field) => {
        const existing =
          state.allProducts.entities[field.id] ??
          state.products.entities[field.id];
        if (!existing) return null;
        if (
          existing.price === field.price &&
          existing.cost === field.cost &&
          existing.profit === field.profit
        ) {
          return null;
        }
        return {
          id: field.id,
          changes: {
            price: field.price,
            cost: field.cost,
            profit: field.profit,
            updatedAt: field.updatedAt,
          },
        };
      })
      .filter((change): change is NonNullable<typeof change> => change !== null);

    if (!changes.length) return state;

    return {
      ...state,
      products: productsAdapter.updateMany(changes, state.products),
      allProducts: productsAdapter.updateMany(changes, state.allProducts),
    };
  }),
  on(CatalogActions.invalidate, () => initialCatalogState),
);
