import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Supply, SupplyCategory } from '../../core/models';

export const SuppliesActions = createActionGroup({
  source: 'Supplies',
  events: {
    Load: props<{
      refresh?: boolean;
      category?: SupplyCategory;
    }>(),
    'Load Success': props<{ supplies: Supply[] }>(),
    'Load Failure': props<{ error: string }>(),
    'Upsert Supply': props<{ supply: Supply }>(),
    'Remove Supply': props<{ id: string }>(),
    Invalidate: emptyProps(),
  },
});
