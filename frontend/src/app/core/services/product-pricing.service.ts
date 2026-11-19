import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import {
  CalculateCostPayload,
  CostBreakdown,
  GeneralSettings,
  Product,
  ProductPricingInput,
  ProductPricingResult,
  ProductType,
} from '../models';
import { SettingsFacade } from '../../store/settings/settings.facade';
import { ProductCostCalculationService } from './product-cost-calculation.service';
import {
  productPackagingValue,
  sumComponentsCost,
  sumComponentsPrice,
} from '../../shared/utils/product.helpers';
import { isEstampadoPrintValid } from '../../shared/utils/estampado.helpers';
import { hasValidFdmFilamentInput } from '../../shared/utils/fdm.helpers';
import {
  getMarginForProductType,
  normalizeProfitMargins,
  resolveProductPrice,
  totalCostFromBreakdown,
} from '../../shared/utils/pricing.util';
import {
  packagingPriceFromValue,
  supplyCostFromValue,
  supplyErrorFromValue,
  supplyPriceFromValue,
} from '../../shared/utils/supply-line-value.util';
import { markupPercentOnCostRounded } from '../../shared/utils/product-margin.util';

@Injectable({ providedIn: 'root' })
export class ProductPricingService {
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly costCalculation = inject(ProductCostCalculationService);

  preview(
    input: ProductPricingInput,
    catalog: Product[],
    settings?: GeneralSettings | null,
  ): Observable<ProductPricingResult> {
    const resolvedSettings = settings ?? this.settingsFacade.peekGeneralSettings();
    if (resolvedSettings) {
      return of(this.previewWithSettings(input, catalog, resolvedSettings));
    }

    return this.settingsFacade.ensureLoaded().pipe(
      map((loaded) => this.previewWithSettings(input, catalog, loaded)),
    );
  }

  applyMarginToCost(
    input: Pick<ProductPricingInput, 'type' | 'components' | 'suggestedPrice' | 'price'>,
    cost: number,
    catalog: Product[],
    settings: GeneralSettings,
    laborCost = 0,
  ): ProductPricingResult {
    const margins = normalizeProfitMargins(settings.profitMargins);
    const margin = getMarginForProductType(input.type, margins);
    const price = resolveProductPrice(input, cost, margins, laborCost);

    return {
      cost,
      price,
      profit: price - cost,
      marginPercent: markupPercentOnCostRounded(price, cost, laborCost) ?? 0,
      configuredMarginPercent: margin,
      breakdown: null,
    };
  }

  private previewWithSettings(
    input: ProductPricingInput,
    catalog: Product[],
    settings: GeneralSettings,
  ): ProductPricingResult {
    const storedCost = Number(input.cost) || 0;
    const hasComponents = (input.components ?? []).length > 0;
    const supplyValue = this.costCalculation.supplyLinesValue(
      input.estampadoSupplies,
    );
    const packagingValue = this.packagingValue(input, catalog);
    const { cost, breakdown } = this.resolveCost(input, catalog, settings);
    const resolvedCost =
      hasComponents || supplyValue > 0 || packagingValue > 0
        ? cost
        : cost <= 0 && storedCost > 0
          ? storedCost
          : cost;
    const resolvedBreakdown =
      hasComponents || cost > 0 || storedCost <= 0
        ? breakdown
        : breakdown?.totalCost === 0
          ? null
          : breakdown;

    return this.buildResult(
      input,
      catalog,
      settings,
      resolvedCost,
      resolvedBreakdown,
      supplyValue,
      packagingValue,
    );
  }

  /**
   * Valor del packaging (§27): el propio y, en un combo con
   * `sumPiecesPackaging`, el de sus piezas × cantidad.
   */
  packagingValue(input: ProductPricingInput, catalog: Product[]): number {
    return productPackagingValue(
      {
        type: input.type,
        packagingSupplies: input.packagingSupplies,
        sumPiecesPackaging: input.sumPiecesPackaging,
        components: input.components,
      },
      catalog,
      (supplyId) => this.costCalculation.supplyUnitPrice(supplyId),
    );
  }

  /**
   * Precio único: el margen se aplica solo al costo de proceso y los insumos
   * de catálogo se suman aparte a valor × 2 + error (`supplyValue` es su
   * valor cantidad × unitario). La mano de obra (`laborCost`, parte de
   * `processCost`) tampoco lleva margen. `cost` del resultado incluye valor
   * y error del insumo (§16.3). El packaging (`packagingValue`) entra al costo
   * a su valor y al precio a valor × 1,25, sin margen de error (§27.2).
   */
  priceWithSupplies(
    input: Pick<
      ProductPricingInput,
      'type' | 'components' | 'suggestedPrice' | 'price'
    >,
    processCost: number,
    supplyValue: number,
    catalog: Product[],
    settings: GeneralSettings,
    laborCost = 0,
    packagingValue = 0,
  ): ProductPricingResult {
    const result = this.applyMarginToCost(
      input,
      processCost,
      catalog,
      settings,
      laborCost,
    );
    const hasComponents = (input.components ?? []).length > 0;
    const suggested =
      input.suggestedPrice != null && Number(input.suggestedPrice) > 0;
    let processPrice = result.price;
    // Combo / armado de piezas: lista = suma de listas de las piezas + armado
    // sin margen (§16.1.3). Con precio fijo manda el fijo.
    if (hasComponents && !suggested) {
      const partsPrice = sumComponentsPrice(
        catalog,
        input.components ?? [],
        (id) => this.costCalculation.supplyUnitPrice(id),
      );
      if (partsPrice > 0) processPrice = partsPrice + laborCost;
    }
    if (
      (supplyValue > 0 || packagingValue > 0) &&
      !suggested &&
      !hasComponents &&
      processCost <= 0
    ) {
      processPrice = 0;
    }
    const errorMarginPercent = Number(settings.errorMarginPercent) || 0;
    // Insumos: valor × 2 + error (el error no lleva el recargo) (§16.3).
    const price =
      processPrice +
      supplyPriceFromValue(supplyValue, errorMarginPercent) +
      packagingPriceFromValue(packagingValue);
    const fullCost =
      processCost +
      supplyCostFromValue(supplyValue, errorMarginPercent) +
      Math.round(Number(packagingValue) || 0);
    return {
      ...result,
      cost: fullCost,
      price,
      profit: price - fullCost,
      marginPercent:
        markupPercentOnCostRounded(price, fullCost, laborCost) ?? 0,
    };
  }

  private buildResult(
    input: ProductPricingInput,
    catalog: Product[],
    settings: GeneralSettings,
    cost: number,
    breakdown: CostBreakdown | null,
    supplyValue = 0,
    packagingValue = 0,
  ): ProductPricingResult {
    const priced = this.priceWithSupplies(
      input,
      cost,
      supplyValue,
      catalog,
      settings,
      breakdown?.laborCost ?? 0,
      packagingValue,
    );
    const supplyError = supplyErrorFromValue(
      supplyValue,
      Number(settings.errorMarginPercent) || 0,
    );
    const withSupplyError =
      breakdown && supplyError > 0
        ? {
            ...breakdown,
            errorMarginCost: (breakdown.errorMarginCost ?? 0) + supplyError,
          }
        : breakdown;
    return {
      ...priced,
      breakdown: withSupplyError,
    };
  }

  private resolveCost(
    input: ProductPricingInput,
    catalog: Product[],
    settings: GeneralSettings,
  ): { cost: number; breakdown: CostBreakdown | null } {
    const components = input.components ?? [];
    const hasComponents = components.length > 0;
    const storedCost = Number(input.cost) || 0;

    if (hasComponents) {
      return this.calculateCompositeCost(input, catalog, components, settings);
    }

    if (input.type === ProductType.FDM || input.type === ProductType.RESINA) {
      const hasFdmMaterial =
        input.type === ProductType.FDM &&
        hasValidFdmFilamentInput(input.filaments ?? []);
      const grams = Number(input.grams) || 0;
      if (
        hasFdmMaterial ||
        (input.type === ProductType.RESINA && grams > 0) ||
        (input.type === ProductType.FDM && grams > 0 && !(input.filaments?.length))
      ) {
        const breakdown = this.calculateBreakdown(input, settings);
        return {
          cost: totalCostFromBreakdown(breakdown),
          breakdown,
        };
      }
    }

    if (input.type === ProductType.ESTAMPADO && this.canCalculateEstampado(input)) {
      const breakdown = this.calculateBreakdown(input, settings);
      return {
        cost: totalCostFromBreakdown(breakdown),
        breakdown,
      };
    }

    return {
      cost: storedCost,
      breakdown: null,
    };
  }

  private calculateCompositeCost(
    input: ProductPricingInput,
    catalog: Product[],
    components: ProductPricingInput['components'],
    settings: GeneralSettings,
  ): { cost: number; breakdown: CostBreakdown | null } {
    const partsCost = sumComponentsCost(
      catalog,
      components ?? [],
      (id) => this.costCalculation.supplyUnitPrice(id),
    );
    const errorMarginCost = 0;
    const assemblyHours = Number(input.assemblyTimeHours) || 0;

    if (assemblyHours <= 0) {
      const totalCost = partsCost;
      return {
        cost: totalCost,
        breakdown: {
          materialCost: partsCost,
          energyCost: 0,
          machineCost: 0,
          errorMarginCost,
          laborCost: 0,
          totalCost,
        },
      };
    }

    const laborBreakdown = this.costCalculation.calculateCost(
      {
        type: input.type,
        grams: 0,
        printTimeHours: 0,
        workTimeHours: assemblyHours,
      },
      { settings },
    );
    const totalCost = partsCost + laborBreakdown.laborCost;

    return {
      cost: totalCost,
      breakdown: {
        materialCost: partsCost,
        energyCost: 0,
        machineCost: 0,
        errorMarginCost,
        laborCost: laborBreakdown.laborCost,
        totalCost,
      },
    };
  }

  private calculateBreakdown(
    input: ProductPricingInput,
    settings: GeneralSettings,
  ): CostBreakdown {
    return this.costCalculation.calculateCost(
      this.toCalculateCostPayload(input),
      { settings },
    );
  }

  private canCalculateEstampado(input: ProductPricingInput): boolean {
    const workTimeHours = Number(input.workTimeHours) || 0;
    const prints = input.estampadoPrints ?? [];
    const pressCycles = input.estampadoPressCycles ?? [];
    const supplies = [
      ...(input.estampadoSupplies ?? []),
      ...(input.packagingSupplies ?? []),
    ];
    const hasPrints = prints.some((print) => isEstampadoPrintValid(print));
    const hasPress = pressCycles.some(
      (cycle) =>
        Number(cycle.pressMinutes) > 0 && Number(cycle.bajadas) >= 1,
    );
    const hasSupplies = supplies.some(
      (line) => line.supplyId && Number(line.quantity) > 0,
    );
    return workTimeHours > 0 || hasPrints || hasPress || hasSupplies;
  }

  private toCalculateCostPayload(
    input: ProductPricingInput,
  ): CalculateCostPayload {
    return {
      type: input.type,
      grams: input.grams,
      purgeGrams: input.purgeGrams,
      printTimeHours: input.printTimeHours,
      workTimeHours: input.workTimeHours,
      brand: input.brand,
      filamentType: input.filamentType,
      filaments: input.filaments,
      resinType: input.resinType,
      washMinutes: input.washMinutes,
      cureMinutes: input.cureMinutes,
      pressMinutes: input.pressMinutes,
      estampadoPrints: input.estampadoPrints,
      estampadoPressCycles: input.estampadoPressCycles,
      estampadoSupplies: input.estampadoSupplies,
      preferredPrinterId: input.preferredPrinterId,
    };
  }
}
