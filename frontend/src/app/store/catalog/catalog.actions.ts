import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Category, Customer, Product, ProductPricingFields, ReferenceData } from '../../core/models';

export const CatalogActions = createActionGroup({
  source: 'Catalog',
  events: {
    Load: props<{ refresh?: boolean }>(),
    'Load Success': props<{ data: ReferenceData }>(),
    'Load Failure': props<{ error: string }>(),

    'Load Products': props<{ all?: boolean; refresh?: boolean }>(),
    'Load Products Success': props<{ products: Product[] }>(),
    'Load Products Failure': props<{ error: string }>(),

    'Load All Products': props<{ refresh?: boolean }>(),
    'Load All Products Success': props<{ products: Product[] }>(),
    'Load All Products Failure': props<{ error: string }>(),

    'Upsert Product': props<{ product: Product }>(),
    'Product Created': emptyProps(),
    'Remove Product': props<{ id: string }>(),
    'Upsert Customer': props<{ customer: Customer }>(),
    'Remove Customer': props<{ id: string }>(),
    'Upsert Category': props<{ category: Category }>(),
    'Remove Category': props<{ id: string }>(),

    'Apply Pricing Fields': props<{ fields: ProductPricingFields[] }>(),

    Invalidate: emptyProps(),
  },
});
