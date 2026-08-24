import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { CostBreakdown, ProductType } from '../../core/models';

export const ProductFormPricingActions = createActionGroup({
  source: 'ProductFormPricing',
  events: {
    Reset: emptyProps(),
    'Set Product Type': props<{ productType: ProductType }>(),
    'Set Product Type Margin': props<{
      productType: ProductType;
      profitMarginPercent: number;
      profitMarginLabel: string;
    }>(),
    'Set Cost Contribution': props<{ source: string; cost: number }>(),
    'Clear Cost Contribution': props<{ source: string }>(),
    'Set Components Price': props<{ componentsPrice: number }>(),
    'Set Calculating': props<{ calculating: boolean }>(),
    'Set Cost Breakdown': props<{ costBreakdown: CostBreakdown | null }>(),
    'Set Suggested Price': props<{ suggestedPrice: number | null }>(),
    'Set Applied Margin': props<{ appliedMarginPercent: number }>(),
    'Set Pricing Result': props<{
      totalCost: number;
      price: number;
      profit: number;
      appliedMarginPercent: number;
    }>(),
  },
});
