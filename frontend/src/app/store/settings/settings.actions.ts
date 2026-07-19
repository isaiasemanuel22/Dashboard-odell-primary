import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { GeneralSettings } from '../../core/models';

export const SettingsActions = createActionGroup({
  source: 'Settings',
  events: {
    Load: props<{ refresh?: boolean }>(),
    'Load Success': props<{ settings: GeneralSettings }>(),
    'Load Failure': props<{ error: string }>(),
    'Set General': props<{ settings: GeneralSettings }>(),
    Invalidate: emptyProps(),
  },
});
