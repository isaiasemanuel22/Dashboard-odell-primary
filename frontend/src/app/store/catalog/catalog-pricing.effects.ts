import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  debounceTime,
  EMPTY,
  filter,
  map,
  switchMap,
  take,
  withLatestFrom,
} from 'rxjs';
import { CatalogPricingSyncService } from '../../core/services/catalog-pricing-sync.service';
import { CatalogActions } from './catalog.actions';
import { selectAllCatalogProducts, selectAllProductsLoaded } from './catalog.selectors';
import { SettingsActions } from '../settings/settings.actions';
import { selectGeneralSettings, selectSettingsLoaded } from '../settings/settings.selectors';
import { SuppliesActions } from '../supplies/supplies.actions';
import { ImpresosActions } from '../impresos/impresos.actions';

@Injectable()
export class CatalogPricingEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly catalogPricingSync = inject(CatalogPricingSyncService);

  private readonly pricingInputActions = [
    SettingsActions.setGeneral,
    SuppliesActions.upsertSupply,
    ImpresosActions.upsertImpreso,
  ] as const;

  /** Recalcula pricing del catálogo en el store (UI) cuando cambian insumos de costo. */
  readonly refreshLocalPricing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(...this.pricingInputActions),
      debounceTime(400),
      withLatestFrom(
        this.store.select(selectAllProductsLoaded),
        this.store.select(selectSettingsLoaded),
      ),
      filter(([, allProductsLoaded, settingsLoaded]) =>
        allProductsLoaded && settingsLoaded,
      ),
      switchMap(() =>
        this.store.select(selectAllCatalogProducts).pipe(
          take(1),
          withLatestFrom(this.store.select(selectGeneralSettings)),
          filter(([products, settings]) => products.length > 0 && settings !== null),
          switchMap(([products, settings]) =>
            this.catalogPricingSync.recalculate(products, settings!).pipe(
              map((fields) => CatalogActions.applyPricingFields({ fields })),
              catchError(() => EMPTY),
            ),
          ),
        ),
      ),
    ),
  );

  /** Tras cargar catálogo + ajustes, alinea pricing local con la configuración actual. */
  readonly refreshLocalPricingAfterLoad$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        CatalogActions.loadSuccess,
        CatalogActions.loadAllProductsSuccess,
        SettingsActions.loadSuccess,
      ),
      debounceTime(100),
      withLatestFrom(
        this.store.select(selectAllProductsLoaded),
        this.store.select(selectSettingsLoaded),
      ),
      filter(([, allProductsLoaded, settingsLoaded]) =>
        allProductsLoaded && settingsLoaded,
      ),
      switchMap(() =>
        this.store.select(selectAllCatalogProducts).pipe(
          take(1),
          withLatestFrom(this.store.select(selectGeneralSettings)),
          filter(([products, settings]) => products.length > 0 && settings !== null),
          switchMap(([products, settings]) =>
            this.catalogPricingSync.recalculate(products, settings!).pipe(
              map((fields) => CatalogActions.applyPricingFields({ fields })),
              catchError(() => EMPTY),
            ),
          ),
        ),
      ),
    ),
  );
}
