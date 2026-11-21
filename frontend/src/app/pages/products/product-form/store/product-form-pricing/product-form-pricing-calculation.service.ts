import { Injectable } from '@angular/core';
import { priceFromCostAndMargin } from '../../../../../shared/utils/pricing.util';
import {
  packagingPriceFromValue,
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
  /** Parte de totalCost que es packaging (valor, sin margen de error): precio = valor × 1,25 (§27.2). */
  packagingValue?: number;
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
    const packagingValue = Math.max(0, Number(input.packagingValue) || 0);
    const packagingPrice = packagingPriceFromValue(packagingValue);

    let price = 0;

    if (Number.isFinite(suggestedPrice) && suggestedPrice > 0) {
      price = suggestedPrice;
    } else if (componentsPrice > 0) {
      // Combo (§16.1.3): lista de las piezas + armado sin margen + insumos × 2 + error.
      price =
        componentsPrice +
        Math.max(0, Number(input.laborCost) || 0) +
        supplyPriceFromValue(supplyValue, errorMarginPercent) +
        packagingPrice;
    } else if (Number.isFinite(catalogPrice) && catalogPrice > 0) {
      price = catalogPrice;
    } else if (totalCost > 0) {
      const cappedSupply = Math.min(totalCost, supplyValue);
      const supplyCost = supplyCostFromValue(
        cappedSupply,
        errorMarginPercent,
      );
      const cappedPackaging = Math.min(
        Math.max(0, totalCost - supplyCost),
        packagingValue,
      );
      price =
        priceFromCostAndMargin(
          Math.max(0, totalCost - supplyCost - cappedPackaging),
          input.profitMarginPercent,
          input.laborCost,
        ) +
        supplyPriceFromValue(cappedSupply, errorMarginPercent) +
        packagingPriceFromValue(cappedPackaging);
    }

    return {
      price,
      profit: price - totalCost,
    };
  }
}
