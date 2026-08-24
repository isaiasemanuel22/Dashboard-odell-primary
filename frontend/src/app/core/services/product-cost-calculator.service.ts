import { Injectable } from '@angular/core';
import { ProductType } from '../models';
import { totalCostFromBreakdown } from '../../shared/utils/pricing.util';
import { CostBreakdown } from '../models';

export interface CostCalculationInput {
  type: ProductType;
  usesPieceAssembly: boolean;
  cost: number;
  productCost?: number;
  costBreakdown: CostBreakdown | null;
  componentsCostTotal: number;
  components: any[];
}

export interface PriceCalculationInput extends CostCalculationInput {
  suggestedPrice: number | null;
  computedPrice: number | null;
  componentsPriceTotal: number;
  configuredProfitMargin: number;
  profitMargins: any;
}

/**
 * Centraliza la lógica de cálculo de costos y precios del producto
 * Elimina la redundancia entre `effectiveCost` y `finalPrice`
 */
@Injectable({
  providedIn: 'root',
})
export class ProductCostCalculatorService {
  /**
   * Calcula el costo efectivo del producto
   */
  calculateEffectiveCost(input: CostCalculationInput): number {
    if (input.usesPieceAssembly) {
      if (!input.components.length) {
        return 0;
      }
      const partsCost =
        input.componentsCostTotal > 0
          ? input.componentsCostTotal
          : 0;
      if (input.costBreakdown) {
        const laborCost = Math.max(0, Number(input.costBreakdown.laborCost) || 0);
        if (partsCost > 0 || laborCost > 0) {
          return partsCost + laborCost;
        }
      }
      if (Number(input.cost) > 0) {
        return Number(input.cost);
      }
      return partsCost;
    }

    const direct = Number(input.cost) || Number(input.productCost) || 0;
    if (direct > 0) {
      return direct;
    }
    if (input.costBreakdown) {
      return totalCostFromBreakdown(input.costBreakdown);
    }
    return 0;
  }

  /**
   * Calcula la ganancia del producto
   */
  calculateProfit(finalPrice: number, effectiveCost: number): number {
    return finalPrice - effectiveCost;
  }

  /**
   * Valida si el componente tiene suficiente información para calcular costo automáticamente
   */
  canAutoCalculate(
    type: ProductType,
    isCombo: boolean,
    usesPieceAssembly: boolean,
    components: any[],
    isEstampado: boolean,
    hasEstampadoPricingInput: boolean,
    isFdm: boolean,
    hasValidFdmFilamentInput: boolean,
    isResina: boolean,
    grams: number,
    is3D: boolean,
  ): boolean {
    if (isCombo) return components.length > 0;
    if (usesPieceAssembly) return components.length > 0;
    if (isEstampado) return hasEstampadoPricingInput;
    if (isFdm) return hasValidFdmFilamentInput;
    if (isResina) return Number(grams) > 0;
    if (!is3D) return false;
    return Number(grams) > 0;
  }
}
