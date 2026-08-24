import { isDevMode } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { CatalogEffects } from './catalog/catalog.effects';
import { CatalogPricingEffects } from './catalog/catalog-pricing.effects';
import { catalogReducer } from './catalog/catalog.reducer';
import { ImpresosEffects } from './impresos/impresos.effects';
import { impresosReducer } from './impresos/impresos.reducer';
import { SettingsEffects } from './settings/settings.effects';
import { settingsReducer } from './settings/settings.reducer';
import { SuppliesEffects } from './supplies/supplies.effects';
import { suppliesReducer } from './supplies/supplies.reducer';
import { ProductFormPricingEffects } from './product-form-pricing/product-form-pricing.effects';
import { productFormPricingReducer } from './product-form-pricing/product-form-pricing.reducer';

export const storeProviders = [
  provideStore({
    catalog: catalogReducer,
    settings: settingsReducer,
    impresos: impresosReducer,
    supplies: suppliesReducer,
    productFormPricing: productFormPricingReducer,
  }),
  provideEffects(
    CatalogEffects,
    CatalogPricingEffects,
    SettingsEffects,
    ImpresosEffects,
    SuppliesEffects,
    ProductFormPricingEffects,
  ),
  ...(isDevMode()
    ? [
        provideStoreDevtools({
          name: 'Odell Dashboard',
          maxAge: 50,
          logOnly: false,
          autoPause: true,
          connectInZone: true,
        }),
      ]
    : []),
];

export { CatalogFacade } from './catalog/catalog.facade';
export { SettingsFacade } from './settings/settings.facade';
export { ImpresosFacade } from './impresos/impresos.facade';
export { SuppliesFacade } from './supplies/supplies.facade';
export { ProductFormPricingFacade } from './product-form-pricing/product-form-pricing.facade';
export { StoreBootstrapService } from './store-bootstrap.service';

export { CatalogActions } from './catalog/catalog.actions';
export { SettingsActions } from './settings/settings.actions';
export { ImpresosActions } from './impresos/impresos.actions';
export { SuppliesActions } from './supplies/supplies.actions';
