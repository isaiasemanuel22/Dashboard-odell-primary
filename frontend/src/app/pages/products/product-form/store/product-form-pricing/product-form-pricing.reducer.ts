import { createReducer, on } from '@ngrx/store';
import { CostBreakdown, ProductType } from '../../../../../core/models';
import { ProductFormPricingCalculationService } from './product-form-pricing-calculation.service';
import { ProductFormPricingActions } from './product-form-pricing.actions';

export interface ProductFormPricingState {
  productType: ProductType | null;
  profitMarginPercent: number;
  profitMarginLabel: string;
  contributions: Record<string, number>;
  totalCost: number;
  componentsPrice: number;
  suggestedPrice: number | null;
  price: number;
  profit: number;
  calculating: boolean;
  costBreakdown: CostBreakdown | null;
  appliedMarginPercent: number | null;
}

const calculator = new ProductFormPricingCalculationService();

export const initialProductFormPricingState: ProductFormPricingState = {
  productType: null,
  profitMarginPercent: 0,
  profitMarginLabel: '',
  contributions: {},
  totalCost: 0,
  componentsPrice: 0,
  suggestedPrice: null,
  price: 0,
  profit: 0,
  calculating: false,
  costBreakdown: null,
  appliedMarginPercent: null,
};

function withTotalCost(
  state: ProductFormPricingState,
  contributions: Record<string, number>,
): ProductFormPricingState {
  return {
    ...state,
    contributions,
    totalCost: calculator.sumContributions(contributions),
  };
}

export const productFormPricingReducer = createReducer(
  initialProductFormPricingState,
  on(ProductFormPricingActions.reset, () => initialProductFormPricingState),
  on(ProductFormPricingActions.setProductTypeMargin, (state, action) => ({
    ...initialProductFormPricingState,
    productType: action.productType,
    profitMarginPercent: action.profitMarginPercent,
    profitMarginLabel: action.profitMarginLabel,
  })),
  on(ProductFormPricingActions.setCostContribution, (state, { source, cost }) =>
    withTotalCost(state, {
      ...state.contributions,
      [source]: Math.max(0, Number(cost) || 0),
    }),
  ),
  on(ProductFormPricingActions.clearCostContribution, (state, { source }) => {
    const contributions = { ...state.contributions };
    delete contributions[source];
    return withTotalCost(state, contributions);
  }),
  on(ProductFormPricingActions.setComponentsPrice, (state, { componentsPrice }) => ({
    ...state,
    componentsPrice: Math.max(0, Number(componentsPrice) || 0),
  })),
  on(ProductFormPricingActions.setCalculating, (state, { calculating }) => ({
    ...state,
    calculating,
  })),
  on(ProductFormPricingActions.setCostBreakdown, (state, { costBreakdown }) => ({
    ...state,
    costBreakdown,
  })),
  on(ProductFormPricingActions.setSuggestedPrice, (state, { suggestedPrice }) => ({
    ...state,
    suggestedPrice:
      suggestedPrice != null && Number(suggestedPrice) > 0
        ? Number(suggestedPrice)
        : null,
  })),
  on(ProductFormPricingActions.setAppliedMargin, (state, { appliedMarginPercent }) => ({
    ...state,
    appliedMarginPercent,
  })),
  on(ProductFormPricingActions.setPricingResult, (state, action) => ({
    ...state,
    totalCost: action.totalCost,
    price: action.price,
    profit: action.profit,
    appliedMarginPercent: action.appliedMarginPercent,
    calculating: false,
  })),
);
