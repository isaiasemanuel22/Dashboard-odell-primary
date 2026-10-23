import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, withLatestFrom } from 'rxjs';
import {
  getMarginForProductType,
  marginLabelForProductType,
  normalizeProfitMargins,
} from '../../../../../shared/utils/pricing.util';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
import { ProductFormPricingCalculationService } from './product-form-pricing-calculation.service';
import { ProductFormPricingActions } from './product-form-pricing.actions';
import { selectProductFormPricingState } from './product-form-pricing.selectors';

@Injectable()
export class ProductFormPricingEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly calculationService = inject(ProductFormPricingCalculationService);

  readonly setMarginOnProductType$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductFormPricingActions.setProductType),
      switchMap(({ productType }) =>
        this.settingsFacade.ensureLoaded().pipe(
          map((settings) => {
            const margins = normalizeProfitMargins(settings.profitMargins);
            return ProductFormPricingActions.setProductTypeMargin({
              productType,
              profitMarginPercent: getMarginForProductType(productType, margins),
              profitMarginLabel: marginLabelForProductType(productType),
            });
          }),
        ),
      ),
    ),
  );

  readonly recalculatePricing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        ProductFormPricingActions.setCostContribution,
        ProductFormPricingActions.clearCostContribution,
        ProductFormPricingActions.setComponentsPrice,
        ProductFormPricingActions.setProductTypeMargin,
        ProductFormPricingActions.setSuggestedPrice,
        ProductFormPricingActions.setCatalogPrice,
        ProductFormPricingActions.setAppliedMargin,
      ),
      withLatestFrom(this.store.select(selectProductFormPricingState)),
      map(([, state]) => {
        const margin =
          state.appliedMarginPercent ?? state.profitMarginPercent;
        const result = this.calculationService.calculate({
          totalCost: state.totalCost,
          profitMarginPercent: margin,
          suggestedPrice: state.suggestedPrice,
          componentsPrice: state.componentsPrice,
          catalogPrice: state.catalogPrice,
        });

        return ProductFormPricingActions.setPricingResult({
          totalCost: state.totalCost,
          price: result.price,
          profit: result.profit,
          appliedMarginPercent: margin,
        });
      }),
    ),
  );
}
