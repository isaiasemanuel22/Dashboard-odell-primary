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
  sumComponentsCost,
} from '../../shared/utils/product.helpers';
import { isEstampadoPrintValid } from '../../shared/utils/estampado.helpers';
import { hasValidFdmFilamentInput } from '../../shared/utils/fdm.helpers';
import {
  getMarginForProductType,
  normalizeProfitMargins,
  resolveProductPrice,
  totalCostFromBreakdown,
} from '../../shared/utils/pricing.util';
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
      marginPercent: markupPercentOnCostRounded(price, cost) ?? 0,
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
    const { cost, breakdown } = this.resolveCost(input, catalog, settings);
    const resolvedCost =
      hasComponents || supplyValue > 0
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
    );
  }

  /**
   * Precio único: el margen se aplica solo al costo de proceso y el valor de
   * los insumos de catálogo se suma aparte, sin margen. La mano de obra
   * (`laborCost`, parte de `processCost`) tampoco lleva margen. `cost` del
   * resultado incluye los insumos.
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
    if (supplyValue > 0 && !suggested && !hasComponents && processCost <= 0) {
      processPrice = 0;
    }
    const price = processPrice + supplyValue;
    const fullCost = processCost + supplyValue;
    return {
      ...result,
      cost: fullCost,
      price,
      profit: price - fullCost,
      marginPercent: markupPercentOnCostRounded(price, fullCost) ?? 0,
    };
  }

  private buildResult(
    input: ProductPricingInput,
    catalog: Product[],
    settings: GeneralSettings,
    cost: number,
    breakdown: CostBreakdown | null,
    supplyValue = 0,
  ): ProductPricingResult {
    return {
      ...this.priceWithSupplies(
        input,
        cost,
        supplyValue,
        catalog,
        settings,
        breakdown?.laborCost ?? 0,
      ),
      breakdown,
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
    const partsCost = sumComponentsCost(catalog, components ?? []);
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
    const supplies = input.estampadoSupplies ?? [];
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
