import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ProductFormPricingState } from './product-form-pricing.reducer';

export const selectProductFormPricingState =
  createFeatureSelector<ProductFormPricingState>('productFormPricing');

export const selectProductFormPricingVm = createSelector(
  selectProductFormPricingState,
  (state) => ({
    productType: state.productType,
    profitMarginPercent: state.appliedMarginPercent ?? state.profitMarginPercent,
    profitMarginLabel: state.profitMarginLabel,
    totalCost: state.totalCost,
    price: state.price,
    profit: state.profit,
    calculating: state.calculating,
    costBreakdown: state.costBreakdown,
    componentsPrice: state.componentsPrice,
  }),
);

export const selectProductFormTotalCost = createSelector(
  selectProductFormPricingState,
  (state) => state.totalCost,
);

export const selectProductFormPrice = createSelector(
  selectProductFormPricingState,
  (state) => state.price,
);

export const selectProductFormProfit = createSelector(
  selectProductFormPricingState,
  (state) => state.profit,
);

export const selectProductFormProfitMargin = createSelector(
  selectProductFormPricingState,
  (state) => state.appliedMarginPercent ?? state.profitMarginPercent,
);
