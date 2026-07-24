import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
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
import { SettingsService } from './settings.service';
import {
  sumComponentsCost,
  sumComponentsPrice,
} from '../../shared/utils/product.helpers';
import { isEstampadoPrintValid } from '../../shared/utils/estampado.helpers';
import {
  getMarginForProductType,
  normalizeProfitMargins,
  resolveProductPrice,
  totalCostFromBreakdown,
} from '../../shared/utils/pricing.util';

@Injectable({ providedIn: 'root' })
export class ProductPricingService {
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly settingsService = inject(SettingsService);

  preview(
    input: ProductPricingInput,
    catalog: Product[],
    settings?: GeneralSettings | null,
  ): Observable<ProductPricingResult> {
    const resolvedSettings = settings ?? this.settingsFacade.peekGeneralSettings();
    if (resolvedSettings) {
      return this.previewWithSettings(input, catalog, resolvedSettings);
    }

    return this.settingsFacade.ensureLoaded().pipe(
      switchMap((loaded) => this.previewWithSettings(input, catalog, loaded)),
    );
  }

  applyMarginToCost(
    input: Pick<ProductPricingInput, 'type' | 'components' | 'suggestedPrice' | 'price'>,
    cost: number,
    catalog: Product[],
    settings: GeneralSettings,
  ): ProductPricingResult {
    const margins = normalizeProfitMargins(settings.profitMargins);
    const margin = getMarginForProductType(input.type, margins);
    const componentPricesTotal = sumComponentsPrice(
      catalog,
      input.components ?? [],
    );
    const price = resolveProductPrice(
      input,
      cost,
      margins,
      componentPricesTotal,
    );

    return {
      cost,
      price,
      profit: price - cost,
      marginPercent: price > 0 ? Math.round(((price - cost) / price) * 100) : 0,
      configuredMarginPercent: margin,
      breakdown: null,
    };
  }

  private previewWithSettings(
    input: ProductPricingInput,
    catalog: Product[],
    settings: GeneralSettings,
  ): Observable<ProductPricingResult> {
    const storedCost = Number(input.cost) || 0;

    return this.resolveCost(input, catalog, settings).pipe(
      map(({ cost, breakdown }) => {
        const resolvedCost =
          cost <= 0 && storedCost > 0 ? storedCost : cost;
        const resolvedBreakdown =
          cost <= 0 && storedCost > 0 && breakdown?.totalCost === 0
            ? null
            : breakdown;

        return this.buildResult(
          input,
          catalog,
          settings,
          resolvedCost,
          resolvedBreakdown,
        );
      }),
    );
  }

  private buildResult(
    input: ProductPricingInput,
    catalog: Product[],
    settings: GeneralSettings,
    cost: number,
    breakdown: CostBreakdown | null,
  ): ProductPricingResult {
    const result = this.applyMarginToCost(input, cost, catalog, settings);
    return { ...result, breakdown };
  }

  private resolveCost(
    input: ProductPricingInput,
    catalog: Product[],
    settings: GeneralSettings,
  ): Observable<{ cost: number; breakdown: CostBreakdown | null }> {
    const components = input.components ?? [];
    const hasComponents = components.length > 0;
    const storedCost = Number(input.cost) || 0;

    if (hasComponents) {
      return this.calculateCompositeCost(input, catalog, components);
    }

    if (input.type === ProductType.FDM || input.type === ProductType.RESINA) {
      const grams = Number(input.grams) || 0;
      if (grams > 0) {
        return this.settingsService
          .calculateCost(this.toCalculateCostPayload(input))
          .pipe(
            map((breakdown) => ({
              cost: totalCostFromBreakdown(breakdown),
              breakdown,
            })),
          );
      }
    }

    if (input.type === ProductType.ESTAMPADO && this.canCalculateEstampado(input)) {
      return this.settingsService
        .calculateCost(this.toCalculateCostPayload(input))
        .pipe(
          map((breakdown) => ({
            cost: totalCostFromBreakdown(breakdown),
            breakdown,
          })),
        );
    }

    const cost = storedCost;
    return of({
      cost,
      breakdown: cost > 0 ? null : null,
    });
  }

  private calculateCompositeCost(
    input: ProductPricingInput,
    catalog: Product[],
    components: ProductPricingInput['components'],
  ): Observable<{ cost: number; breakdown: CostBreakdown | null }> {
    const partsCost = sumComponentsCost(catalog, components ?? []);
    // El margen de error ya está incluido en el costo de cada pieza.
    const errorMarginCost = 0;
    const assemblyHours = Number(input.assemblyTimeHours) || 0;

    if (assemblyHours <= 0) {
      const totalCost = partsCost;
      return of({
        cost: totalCost,
        breakdown: {
          materialCost: partsCost,
          energyCost: 0,
          machineCost: 0,
          errorMarginCost,
          laborCost: 0,
          totalCost,
        },
      });
    }

    return this.settingsService
      .calculateCost({
        type: input.type,
        grams: 0,
        printTimeHours: 0,
        workTimeHours: assemblyHours,
      })
      .pipe(
        map((laborBreakdown) => {
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
        }),
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
      printTimeHours: input.printTimeHours,
      workTimeHours: input.workTimeHours,
      brand: input.brand,
      filamentType: input.filamentType,
      resinType: input.resinType,
      washMinutes: input.washMinutes,
      cureMinutes: input.cureMinutes,
      pressMinutes: input.pressMinutes,
      estampadoPrints: input.estampadoPrints,
      estampadoPressCycles: input.estampadoPressCycles,
      estampadoSupplies: input.estampadoSupplies,
    };
  }
}
