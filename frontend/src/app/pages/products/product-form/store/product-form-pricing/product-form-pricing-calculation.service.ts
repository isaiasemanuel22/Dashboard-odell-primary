import { Injectable } from '@angular/core';
import { priceFromCostAndMargin } from '../../../../../shared/utils/pricing.util';
import {
  supplyCostFromValue,
  supplyPriceFromValue,
} from '../../../../../shared/utils/supply-line-value.util';

export interface ProductFormPricingCalculationInput {
  totalCost: number;
  profitMarginPercent: number;
  suggestedPrice?: number | null;
  componentsPrice?: number;
  catalogPrice?: number | null;
  /** Parte de totalCost que es valor de insumos (cantidad × unitario), sin error. */
  supplyValue?: number;
  /** Margen de error de Ajustes (0–100); el error del insumo no lleva el recargo. */
  errorMarginPercent?: number;
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
    const componentsPrice = Math.max(0, Number(input.componentsPrice) || 0);
    const errorMarginPercent = Number(input.errorMarginPercent) || 0;
    const supplyValue = Math.max(0, Number(input.supplyValue) || 0);

    let price = 0;

    if (Number.isFinite(suggestedPrice) && suggestedPrice > 0) {
      price = suggestedPrice;
    } else if (componentsPrice > 0) {
      // Combo (§16.1.3): lista de las piezas + armado sin margen + insumos × 2 + error.
      price =
        componentsPrice +
        Math.max(0, Number(input.laborCost) || 0) +
        supplyPriceFromValue(supplyValue, errorMarginPercent);
    } else if (Number.isFinite(catalogPrice) && catalogPrice > 0) {
      price = catalogPrice;
    } else if (totalCost > 0) {
      const cappedSupply = Math.min(totalCost, supplyValue);
      const supplyCost = supplyCostFromValue(
        cappedSupply,
        errorMarginPercent,
      );
      price =
        priceFromCostAndMargin(
          Math.max(0, totalCost - supplyCost),
          input.profitMarginPercent,
          input.laborCost,
        ) + supplyPriceFromValue(cappedSupply, errorMarginPercent);
    }

    return {
      price,
      profit: price - totalCost,
    };
  }
}
