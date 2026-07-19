import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Category, Customer, Product, ReferenceData } from '../../core/models';

export const CatalogActions = createActionGroup({
  source: 'Catalog',
  events: {
    Load: props<{ refresh?: boolean }>(),
    'Load Success': props<{ data: ReferenceData }>(),
    'Load Failure': props<{ error: string }>(),

    'Upsert Product': props<{ product: Product }>(),
    'Remove Product': props<{ id: string }>(),
    'Upsert Customer': props<{ customer: Customer }>(),
    'Remove Customer': props<{ id: string }>(),
    'Upsert Category': props<{ category: Category }>(),
    'Remove Category': props<{ id: string }>(),

    Invalidate: emptyProps(),
  },
});
