import { CatalogState } from './catalog/catalog.reducer';
import { ImpresosState } from './impresos/impresos.reducer';
import { SettingsState } from './settings/settings.reducer';
import { SuppliesState } from './supplies/supplies.reducer';

export interface AppState {
  catalog: CatalogState;
  settings: SettingsState;
  impresos: ImpresosState;
  supplies: SuppliesState;
}
