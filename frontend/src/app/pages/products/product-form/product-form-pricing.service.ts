import { Injectable, inject } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import {
  CostBreakdown,
  GeneralSettings,
  Product,
  ProductType,
  isProductType3D,
} from '../../../core/models';
import { ProductPricingService } from '../../../core/services/product-pricing.service';
import { ProductCostCalculatorService } from './services/product-cost-calculator.service';
import { ProductPayloadBuilderService } from './services/product-payload-builder.service';
import { SettingsFacade } from '../../../store/settings/settings.facade';
import { ProductFormPricingFacade } from './store/product-form-pricing/product-form-pricing.facade';
import { ProductFormGroup } from './services/product-form-state-manager.service';
import {
  getMarginForProductType,
  marginLabelForProductType,
  normalizeProfitMargins,
  priceFromCostAndMargin,
  totalCostFromBreakdown,
} from '../../../shared/utils/pricing.util';
import { totalFdmFilamentGrams, hasValidFdmFilamentInput } from '../../../shared/utils/fdm.helpers';
import {
  componentsCostTotal,
  componentsPriceTotal,
  formType,
  hasEstampadoPricingInput,
  isForm3D,
  isFormCombo,
  isFormEstampado,
  isFormFdm,
  isFormResina,
  usesFormPieceAssembly,
} from './product-form.view-model';

export interface ProductFormPricingContext {
  form: ProductFormGroup;
  catalogProducts: Product[];
  product: Product | null;
}

@Injectable()
export class ProductFormPricingService {
  private readonly productPricing = inject(ProductPricingService);
  private readonly costCalculator = inject(ProductCostCalculatorService);
  private readonly payloadBuilder = inject(ProductPayloadBuilderService);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly pricingStore = inject(ProductFormPricingFacade);

  private context: ProductFormPricingContext | null = null;
  private costCalcTimer: ReturnType<typeof setTimeout> | null = null;
  private pricingPreviewSub: Subscription | null = null;
  private settingsSubscription: Subscription | null = null;

  readonly stateChanged$ = new Subject<void>();

  cost = 0;
  costBreakdown: CostBreakdown | null = null;
  calculatingCost = false;
  computedPrice: number | null = null;
  private keepCatalogPrice = false;
  appliedMarginPercent: number | null = null;
  profitMargins: GeneralSettings['profitMargins'] | null = null;

  bind(context: ProductFormPricingContext): void {
    this.context = context;
  }

  init(): void {
    const cached = this.settingsFacade.peekGeneralSettings();
    if (cached) {
      this.profitMargins = normalizeProfitMargins(cached.profitMargins);
    }

    this.settingsSubscription = this.settingsFacade
      .watchGeneralSettings()
      .subscribe((settings) => {
        if (!settings) return;
        this.profitMargins = normalizeProfitMargins(settings.profitMargins);
        if (this.keepCatalogPrice) {
          this.scheduleCostCalculation();
          return;
        }
        this.recalculatePriceFromCost();
        this.emitChange();
      });
  }

  destroy(): void {
    this.clearCostCalcTimer();
    this.pricingPreviewSub?.unsubscribe();
    this.settingsSubscription?.unsubscribe();
    this.stateChanged$.complete();
  }

  resetFromState(input: {
    cost: number;
    costBreakdown: CostBreakdown | null;
    computedPrice: number | null;
    appliedMarginPercent: number | null;
  }): void {
    this.cost = input.cost;
    this.costBreakdown = input.costBreakdown;
    this.computedPrice = input.computedPrice;
    this.appliedMarginPercent = input.appliedMarginPercent;
    this.keepCatalogPrice = (input.computedPrice ?? 0) > 0;
    if (this.keepCatalogPrice) {
      this.publishCatalogPrice();
    }
  }

  clearPricingState(): void {
    this.costBreakdown = null;
    this.computedPrice = null;
    this.appliedMarginPercent = null;
  }

  get configuredProfitMargin(): number {
    if (!this.context || !this.profitMargins) return 0;
    return getMarginForProductType(formType(this.context.form), this.profitMargins);
  }

  get displayedProfitMargin(): number {
    return this.appliedMarginPercent ?? this.configuredProfitMargin;
  }

  get configuredProfitMarginLabel(): string {
    if (!this.context) return '';
    return marginLabelForProductType(formType(this.context.form));
  }

  get effectiveCost(): number {
    if (!this.context) return 0;
    const form = this.context.form;
    return this.costCalculator.calculateEffectiveCost({
      type: formType(form),
      usesPieceAssembly: usesFormPieceAssembly(form),
      cost: this.cost,
      productCost: this.context.product?.cost,
      costBreakdown: this.costBreakdown,
      componentsCostTotal: componentsCostTotal(
        this.context.catalogProducts,
        form,
      ),
      components: form.controls.components.value,
    });
  }

  get finalPrice(): number {
    if (!this.context) return 0;
    const form = this.context.form;
    const suggestedPrice = form.controls.suggestedPrice.value;

    if (suggestedPrice != null && Number(suggestedPrice) > 0) {
      return Number(suggestedPrice);
    }

    if (usesFormPieceAssembly(form)) {
      const partsPrice = componentsPriceTotal(
        this.context.catalogProducts,
        form,
      );
      if (partsPrice > 0) {
        return partsPrice;
      }
      return 0;
    }

    if (this.computedPrice != null) {
      return this.computedPrice;
    }

    const costValue = this.effectiveCost;
    if (costValue > 0 && this.profitMargins) {
      return priceFromCostAndMargin(costValue, this.configuredProfitMargin);
    }
    return costValue;
  }

  get profit(): number {
    return this.costCalculator.calculateProfit(this.finalPrice, this.effectiveCost);
  }

  canAutoCalculate(): boolean {
    if (!this.context) return false;
    const form = this.context.form;
    return this.costCalculator.canAutoCalculate(
      formType(form),
      isFormCombo(form),
      usesFormPieceAssembly(form),
      form.controls.components.value,
      isFormEstampado(form),
      hasEstampadoPricingInput(form),
      isFormFdm(form),
      hasValidFdmFilamentInput(form.controls.filamentLines.value),
      isFormResina(form),
      form.controls.grams.value,
      isForm3D(form),
    );
  }

  applyPieceAssemblyTotals(): void {
    if (!this.context) return;
    const form = this.context.form;
    const components = form.controls.components.value;

    if (!components.length) {
      this.cost = 0;
      this.computedPrice = null;
      this.costBreakdown = null;
      this.emitChange();
      return;
    }

    const partsCost = componentsCostTotal(this.context.catalogProducts, form);
    const partsPrice = componentsPriceTotal(this.context.catalogProducts, form);
    const assemblyHours = Number(form.controls.assemblyTimeHours.value) || 0;
    const settings = this.settingsFacade.peekGeneralSettings();
    const laborCost =
      settings && assemblyHours > 0
        ? Math.round(assemblyHours * settings.laborCostPerHour)
        : 0;

    this.cost = partsCost + laborCost;
    this.computedPrice = partsPrice;
    this.costBreakdown = {
      materialCost: partsCost,
      energyCost: 0,
      machineCost: 0,
      errorMarginCost: 0,
      laborCost,
      totalCost: partsCost + laborCost,
    };
    this.appliedMarginPercent = null;
    this.emitChange();
  }

  onComponentsChange(): void {
    if (!this.context) return;
    this.releaseCatalogPrice();
    if (usesFormPieceAssembly(this.context.form)) {
      this.applyPieceAssemblyTotals();
    }
    this.scheduleCostCalculation();
  }

  onProductionFieldChange(): void {
    this.releaseCatalogPrice();
    this.scheduleCostCalculation();
  }

  onIncludesPiecesChange(enabled: boolean): void {
    if (!this.context) return;
    const form = this.context.form;

    if (!enabled) {
      form.patchValue(
        {
          components: [],
          assemblyTimeHours: 0,
          componentPicker: '',
          componentQty: 1,
        },
        { emitEvent: false },
      );
    }

    this.clearPricingState();
    if (usesFormPieceAssembly(form)) {
      this.cost = 0;
    }
    this.onComponentsChange();
  }

  onTypeChange(): void {
    if (!this.context) return;
    const form = this.context.form;

    if (isFormCombo(form)) {
      form.patchValue(
        { includesPieces: true, published: true },
        { emitEvent: false },
      );
    }

    this.releaseCatalogPrice();
    this.clearPricingState();
    this.scheduleCostCalculation();
  }

  prepareForSubmit(): { finalPrice: number; effectiveCost: number } {
    this.clearCostCalcTimer();
    this.pricingPreviewSub?.unsubscribe();
    this.pricingPreviewSub = null;
    this.calculatingCost = false;

    if (!this.context) {
      return { finalPrice: 0, effectiveCost: 0 };
    }

    const form = this.context.form;
    if (usesFormPieceAssembly(form)) {
      this.applyPieceAssemblyTotals();
    } else {
      this.recalculatePriceFromCost();
    }

    this.syncToStore();
    return {
      finalPrice: this.finalPrice,
      effectiveCost: this.effectiveCost,
    };
  }

  scheduleCostCalculation(): void {
    if (!this.context) return;
    const form = this.context.form;

    this.clearCostCalcTimer();
    if (!this.canAutoCalculate()) {
      if (this.keepCatalogPrice) {
        this.publishCatalogPrice();
        return;
      }
      if (isFormEstampado(form) && !usesFormPieceAssembly(form)) {
        this.costBreakdown = null;
        if (!this.context.product) {
          this.cost = 0;
        }
      } else if (
        !isForm3D(form) &&
        !isFormEstampado(form) &&
        !isFormCombo(form) &&
        !usesFormPieceAssembly(form)
      ) {
        this.cost = 0;
        this.costBreakdown = null;
        this.computedPrice = null;
      }
      this.recalculatePriceFromCost();
      return;
    }

    if (!this.keepCatalogPrice) {
      this.computedPrice = null;
      this.appliedMarginPercent = null;
    }
    this.costCalcTimer = setTimeout(() => this.calculateCost(), 500);
  }

  private calculateCost(): void {
    if (!this.context) return;
    const form = this.context.form;

    if (usesFormPieceAssembly(form)) {
      this.applyPieceAssemblyTotals();
      return;
    }

    if (!isForm3D(form) && !isFormEstampado(form)) return;
    if (isForm3D(form) && isFormResina(form) && Number(form.controls.grams.value) <= 0) {
      return;
    }
    if (
      isFormFdm(form) &&
      !hasValidFdmFilamentInput(form.controls.filamentLines.value)
    ) {
      return;
    }

    this.runPricingPreview();
  }

  private runPricingPreview(): void {
    const settings = this.settingsFacade.peekGeneralSettings();
    if (!settings) {
      this.settingsFacade.ensureLoaded().subscribe({
        next: (loaded) => this.runPricingPreviewWithSettings(loaded),
        error: () => {
          this.recalculatePriceFromCost();
          this.emitChange();
        },
      });
      return;
    }

    this.runPricingPreviewWithSettings(settings);
  }

  private runPricingPreviewWithSettings(settings: GeneralSettings): void {
    if (!this.context) return;
    const form = this.context.form;

    if (usesFormPieceAssembly(form)) {
      this.applyPieceAssemblyTotals();
      return;
    }

    this.pricingPreviewSub?.unsubscribe();
    this.calculatingCost = true;
    this.emitChange();

    this.pricingPreviewSub = this.productPricing
      .preview(
        this.buildPricingInput(),
        this.context.catalogProducts,
        settings,
      )
      .subscribe({
        next: (result) => {
          this.costBreakdown = result.breakdown;
          const resolvedCost =
            result.cost > 0
              ? result.cost
              : result.breakdown
                ? totalCostFromBreakdown(result.breakdown)
                : 0;

          if (usesFormPieceAssembly(form)) {
            this.cost =
              resolvedCost > 0
                ? resolvedCost
                : componentsCostTotal(this.context!.catalogProducts, form);
            const partsPrice = componentsPriceTotal(
              this.context!.catalogProducts,
              form,
            );
            this.computedPrice =
              partsPrice > 0
                ? partsPrice
                : result.price > 0
                  ? result.price
                  : this.cost > 0
                    ? priceFromCostAndMargin(
                        this.cost,
                        result.configuredMarginPercent ??
                          this.configuredProfitMargin,
                      )
                    : null;
          } else {
            this.cost = resolvedCost;
            const suggested = Number(form.controls.suggestedPrice.value);
            const priceFollowsCost =
              isForm3D(form) && resolvedCost > 0 && !(suggested > 0);
            if (priceFollowsCost) {
              this.keepCatalogPrice = false;
            }
            if (!this.keepCatalogPrice) {
              this.computedPrice =
                result.price > 0
                  ? result.price
                  : resolvedCost > 0
                    ? priceFromCostAndMargin(
                        resolvedCost,
                        result.configuredMarginPercent ??
                          this.configuredProfitMargin,
                      )
                    : 0;
              if (priceFollowsCost && this.computedPrice != null) {
                this.pricingStore.setCatalogPrice(this.computedPrice);
              }
            }
          }

          this.appliedMarginPercent =
            result.configuredMarginPercent ?? result.marginPercent;
          this.calculatingCost = false;
          this.pricingPreviewSub = null;
          this.emitChange();
        },
        error: () => {
          this.recalculatePriceFromCost();
          this.calculatingCost = false;
          this.pricingPreviewSub = null;
          this.emitChange();
        },
      });
  }

  private releaseCatalogPrice(): void {
    if (!this.keepCatalogPrice) return;
    this.keepCatalogPrice = false;
    this.pricingStore.setCatalogPrice(null);
  }

  private publishCatalogPrice(): void {
    const price = Number(this.computedPrice) || 0;
    if (price <= 0) return;
    this.pricingStore.setCatalogPrice(price);
    this.pricingStore.setCostContribution(
      'production',
      Math.max(0, Number(this.cost) || 0),
    );
  }

  private recalculatePriceFromCost(): void {
    if (!this.context || this.keepCatalogPrice) return;
    const form = this.context.form;
    const settings = this.settingsFacade.peekGeneralSettings();
    if (!settings) return;

    const suggestedPrice = form.controls.suggestedPrice.value;
    if (suggestedPrice != null && Number(suggestedPrice) > 0) {
      return;
    }

    if (usesFormPieceAssembly(form)) {
      const partsCost = componentsCostTotal(this.context.catalogProducts, form);
      const partsPrice = componentsPriceTotal(this.context.catalogProducts, form);
      const assemblyHours = Number(form.controls.assemblyTimeHours.value) || 0;
      const settings = this.settingsFacade.peekGeneralSettings();
      const laborCost =
        settings && assemblyHours > 0
          ? Math.round(assemblyHours * settings.laborCostPerHour)
          : 0;
      this.cost = partsCost + laborCost;
      this.computedPrice = partsPrice;
      this.costBreakdown = {
        materialCost: partsCost,
        energyCost: 0,
        machineCost: 0,
        errorMarginCost: 0,
        laborCost,
        totalCost: partsCost + laborCost,
      };
      this.appliedMarginPercent = null;
      this.emitChange();
      return;
    }

    const costValue = this.effectiveCost;
    if (costValue <= 0) {
      return;
    }

    const result = this.productPricing.applyMarginToCost(
      this.buildPricingInput(),
      costValue,
      this.context.catalogProducts,
      settings,
    );
    this.cost = costValue;
    this.computedPrice = result.price;
    this.appliedMarginPercent = result.configuredMarginPercent ?? null;
    this.emitChange();
  }

  private buildPricingInput() {
    if (!this.context) {
      throw new Error('ProductFormPricingService: context not bound');
    }

    const form = this.context.form;
    const v = form.getRawValue();

    return this.payloadBuilder.buildPricingInput(
      v.type,
      v.type === ProductType.COMBO || v.includesPieces,
      v.components,
      v.assemblyTimeHours,
      v.suggestedPrice,
      this.cost,
      this.context.product?.cost,
      v.type === ProductType.COMBO,
      isProductType3D(v.type),
      v.type === ProductType.FDM,
      totalFdmFilamentGrams(v.filamentLines),
      v.grams,
      v.printTimeHours,
      v.workTimeHours,
      v.filamentLines,
      v.filamentType,
      v.type === ProductType.RESINA,
      v.resinType,
      v.colorId,
      v.washMinutes,
      v.cureMinutes,
      v.prints,
      v.pressCycles,
      v.supplyLines,
    );
  }

  private clearCostCalcTimer(): void {
    if (this.costCalcTimer) {
      clearTimeout(this.costCalcTimer);
      this.costCalcTimer = null;
    }
  }

  private emitChange(): void {
    this.syncToStore();
    this.stateChanged$.next();
  }

  private syncToStore(): void {
    if (!this.context) {
      return;
    }

    const form = this.context.form;
    this.pricingStore.setCalculating(this.calculatingCost);
    if (usesFormPieceAssembly(form)) {
      const partsCost = componentsCostTotal(
        this.context.catalogProducts,
        form,
      );
      const partsPrice = componentsPriceTotal(
        this.context.catalogProducts,
        form,
      );
      const laborCost = Math.max(0, (Number(this.cost) || 0) - partsCost);
      this.pricingStore.setCostContribution('components', partsCost);
      if (laborCost > 0) {
        this.pricingStore.setCostContribution('assembly', laborCost);
      } else {
        this.pricingStore.clearCostContribution('assembly');
      }
      this.pricingStore.clearCostContribution('production');
      this.pricingStore.setComponentsPrice(partsPrice);
      this.pricingStore.setCostBreakdown(this.costBreakdown);
    } else {
      this.pricingStore.setCostBreakdown(this.costBreakdown);
      this.pricingStore.clearCostContribution('components');
      this.pricingStore.setComponentsPrice(0);
      this.pricingStore.setCostContribution('production', this.effectiveCost);
    }

    if (this.appliedMarginPercent != null) {
      this.pricingStore.setAppliedMargin(this.appliedMarginPercent);
    }

    this.pricingStore.setSuggestedPrice(form.controls.suggestedPrice.value);
  }
}
