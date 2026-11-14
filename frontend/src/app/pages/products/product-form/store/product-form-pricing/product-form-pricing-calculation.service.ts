import { Injectable } from '@angular/core';
import { priceFromCostAndMargin } from '../../../../../shared/utils/pricing.util';

export interface ProductFormPricingCalculationInput {
  totalCost: number;
  profitMarginPercent: number;
  suggestedPrice?: number | null;
  componentsPrice?: number;
  catalogPrice?: number | null;
  /** Parte de totalCost que son insumos de catálogo: se suma sin margen. */
  supplyValue?: number;
  /** Parte de totalCost que es mano de obra: se suma sin margen. */
  laborCost?: number;
}

export interface ProductFormPricingCalculationResult {
  price: number;
  profit: number;
}

@Injectable({ providedIn: 'root' })
export class ProductFormPricingCalculationService {
  sumContributions(contributions: Record<string, number>): number {
    return Object.values(contributions).reduce(
      (total, value) => total + (Number(value) || 0),
      0,
    );
  }

  calculate(
    input: ProductFormPricingCalculationInput,
  ): ProductFormPricingCalculationResult {
    const totalCost = Math.max(0, Number(input.totalCost) || 0);
    const suggestedPrice = Number(input.suggestedPrice);
    const catalogPrice = Number(input.catalogPrice);

    let price = 0;

    if (Number.isFinite(suggestedPrice) && suggestedPrice > 0) {
      price = suggestedPrice;
    } else if (Number.isFinite(catalogPrice) && catalogPrice > 0) {
      price = catalogPrice;
    } else if (totalCost > 0) {
      const supplyValue = Math.min(
        totalCost,
        Math.max(0, Number(input.supplyValue) || 0),
      );
      price =
        priceFromCostAndMargin(
          totalCost - supplyValue,
          input.profitMarginPercent,
          input.laborCost,
        ) + supplyValue;
    }

    return {
      price,
      profit: price - totalCost,
    };
  }
}
