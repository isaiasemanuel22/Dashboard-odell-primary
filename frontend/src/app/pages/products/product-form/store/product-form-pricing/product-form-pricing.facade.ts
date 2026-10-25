import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { CostBreakdown, ProductType } from '../../../../../core/models';
import { ProductFormPricingActions } from './product-form-pricing.actions';
import {
  selectProductFormPricingVm,
  selectProductFormPricingState,
} from './product-form-pricing.selectors';

export interface ProductFormPricingVm {
  productType: ProductType | null;
  profitMarginPercent: number;
  profitMarginLabel: string;
  totalCost: number;
  price: number;
  profit: number;
  calculating: boolean;
  costBreakdown: CostBreakdown | null;
  componentsPrice: number;
}

@Injectable({ providedIn: 'root' })
export class ProductFormPricingFacade {
  private readonly store = inject(Store);

  readonly vm$: Observable<ProductFormPricingVm> = this.store.select(
    selectProductFormPricingVm,
  );

  private readonly stateSignal = this.store.selectSignal(
    selectProductFormPricingState,
  );

  reset(): void {
    this.store.dispatch(ProductFormPricingActions.reset());
  }

  setProductType(productType: ProductType): void {
    this.store.dispatch(ProductFormPricingActions.setProductType({ productType }));
  }

  setCostContribution(source: string, cost: number): void {
    this.store.dispatch(
      ProductFormPricingActions.setCostContribution({ source, cost }),
    );
  }

  clearCostContribution(source: string): void {
    this.store.dispatch(
      ProductFormPricingActions.clearCostContribution({ source }),
    );
  }

  setComponentsPrice(componentsPrice: number): void {
    this.store.dispatch(
      ProductFormPricingActions.setComponentsPrice({ componentsPrice }),
    );
  }

  setCalculating(calculating: boolean): void {
    this.store.dispatch(ProductFormPricingActions.setCalculating({ calculating }));
  }

  setCostBreakdown(costBreakdown: CostBreakdown | null): void {
    this.store.dispatch(
      ProductFormPricingActions.setCostBreakdown({ costBreakdown }),
    );
  }

  setSuggestedPrice(suggestedPrice: number | null): void {
    this.store.dispatch(
      ProductFormPricingActions.setSuggestedPrice({ suggestedPrice }),
    );
  }

  setCatalogPrice(catalogPrice: number | null): void {
    this.store.dispatch(
      ProductFormPricingActions.setCatalogPrice({ catalogPrice }),
    );
  }

  setAppliedMargin(appliedMarginPercent: number): void {
    this.store.dispatch(
      ProductFormPricingActions.setAppliedMargin({ appliedMarginPercent }),
    );
  }

  peekTotalCost(): number {
    return this.stateSignal().totalCost;
  }

  peekPrice(): number {
    return this.stateSignal().price;
  }

  peekProfit(): number {
    return this.stateSignal().profit;
  }

  peekProfitMargin(): number {
    return (
      this.stateSignal().appliedMarginPercent ??
      this.stateSignal().profitMarginPercent
    );
  }

  peekCalculating(): boolean {
    return this.stateSignal().calculating;
  }

  peekCostBreakdown(): CostBreakdown | null {
    return this.stateSignal().costBreakdown;
  }

  peekProfitMarginLabel(): string {
    return this.stateSignal().profitMarginLabel;
  }
}
