import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ImpresoWithCost, PaperType } from '../../core/models';

export const ImpresosActions = createActionGroup({
  source: 'Impresos',
  events: {
    Load: props<{ refresh?: boolean; paperType?: PaperType }>(),
    'Load Success': props<{ impresos: ImpresoWithCost[] }>(),
    'Load Failure': props<{ error: string }>(),
    'Upsert Impreso': props<{ impreso: ImpresoWithCost }>(),
    'Remove Impreso': props<{ id: string }>(),
    Invalidate: emptyProps(),
  },
});
