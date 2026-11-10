import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  inject, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import {
  DbSegmentedControlComponent,
  DbSegmentOption,
} from '../../../../components/db-segmented-control/db-segmented-control.component';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import {
  GeneralSettings,
  ProductType,
} from '../../../../core/models';
import { SettingsFacade } from '../../../../store/settings/settings.facade';
import { selectPrintProfileForCost } from '../../../../shared/utils/machine-profile.util';
import { totalFdmFilamentGrams } from '../../../../shared/utils/fdm.helpers';
import {
  getMarginForProductType,
  marginLabelForProductType,
} from '../../../../shared/utils/pricing.util';
import { markupPercentOnCostRounded } from '../../../../shared/utils/product-margin.util';
import { ProductFormGroup } from '../services/product-form-state-manager.service';
import { ProductFormPricingFacade } from '../store/product-form-pricing/product-form-pricing.facade';
import { ProductFormFacade } from '../product-form.facade';
import { ProductFormPricingService } from '../product-form-pricing.service';

type PriceMode = 'calculated' | 'fixed';

@Component({
  selector: 'app-product-form-pricing-section',
  standalone: true,
  imports: [
    FormsModule,
    AsyncPipe,
    CurrencyArsPipe,
    DbSegmentedControlComponent,
  ],
  templateUrl: './product-form-pricing-section.component.html',
  styleUrl: './product-form-pricing-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormPricingSectionComponent implements OnInit, OnDestroy {
  private readonly pricingStore = inject(ProductFormPricingFacade);
  private readonly pricing = inject(ProductFormPricingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private settings: GeneralSettings | null = null;

  @Input({ required: true }) facade!: ProductFormFacade;
  @Input({ required: true }) form!: ProductFormGroup;

  readonly vm$ = this.pricingStore.vm$;

  readonly priceModeOptions: DbSegmentOption<PriceMode>[] = [
    { value: 'calculated', label: 'Calculado' },
    { value: 'fixed', label: 'Precio fijo' },
  ];

  ngOnInit(): void {
    const stored = Number(this.form.controls.suggestedPrice.value) || 0;
    if (stored > 0) {
      this.pricing.adoptStoredManualPrice();
    }
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.cdr.markForCheck();
    });
    this.settingsFacade
      .watchUntilDestroyed(this.destroyRef)
      .subscribe((settings) => {
        this.settings = settings;
        this.cdr.markForCheck();
      });
  }

  get gramsLabel(): string | null {
    const type = this.form.controls.type.value;
    if (type === ProductType.FDM) {
      return `${totalFdmFilamentGrams(this.form.controls.filamentLines.value)} g`;
    }
    if (type === ProductType.RESINA) {
      return `${Number(this.form.controls.grams.value) || 0} ml`;
    }
    return null;
  }

  get purgeLabel(): string | null {
    if (this.form.controls.type.value !== ProductType.FDM) return null;
    const grams = Math.max(0, Number(this.form.controls.purgeGrams.value) || 0);
    if (grams <= 0) return null;
    const label = new Intl.NumberFormat('es-AR', {
      maximumFractionDigits: 1,
    }).format(grams);
    return `${label} g`;
  }

  get lightLabel(): string | null {
    const printer = this.printProfile();
    return printer ? `${printer.watts} W` : null;
  }

  get machineLabel(): string | null {
    const printer = this.printProfile();
    return printer ? `${this.money(printer.costPerHour)}/h` : null;
  }

  get errorMarginLabel(): string | null {
    if (!this.settings) return null;
    return `${this.settings.errorMarginPercent}%`;
  }

  get laborLabel(): string | null {
    if (!this.settings) return null;
    return `${this.money(this.settings.laborCostPerHour)}/h`;
  }

  get piecesUnitsLabel(): string | null {
    const units = this.facade.components.reduce(
      (sum, item) => sum + Math.max(1, Math.trunc(Number(item.quantity) || 1)),
      0,
    );
    return units > 0 ? `${units} u` : null;
  }

  get assemblyHoursLabel(): string | null {
    const hours = Number(this.form.controls.assemblyTimeHours.value) || 0;
    if (hours <= 0) return null;
    return `${String(hours).replace('.', ',')} h`;
  }

  /** Objetivo del área (ajustes), no el margen del precio cargado. */
  get targetMarginPercent(): number {
    if (!this.settings) return 0;
    return getMarginForProductType(
      this.form.controls.type.value,
      this.settings.profitMargins,
    );
  }

  get targetMarginLabel(): string {
    return marginLabelForProductType(this.form.controls.type.value);
  }

  get supplyCost(): number {
    return this.pricing.supplyValue();
  }

  get priceManual(): boolean {
    return this.pricing.manualUnitPrice != null && this.pricing.manualUnitPrice > 0;
  }

  get priceMode(): PriceMode {
    return this.priceManual ? 'fixed' : 'calculated';
  }

  onPriceModeChange(mode: PriceMode): void {
    if (mode === 'calculated') {
      this.resetUnitPrice();
      return;
    }
    const calculated = Math.round(Number(this.pricing.computedPrice) || 0);
    const current = this.priceManual
      ? Math.round(Number(this.pricing.manualUnitPrice) || 0)
      : calculated;
    const amount = current > 0 ? current : calculated;
    if (amount > 0) {
      this.pricing.applyManualUnitPrice(amount);
    }
    this.cdr.markForCheck();
  }

  stalePriceNotice(displayedPrice: number): string | null {
    if (this.priceManual) return null;
    const catalog = Math.round(Number(this.facade.product?.price) || 0);
    const next = Math.round(
      Number(this.pricing.computedPrice) || Number(displayedPrice) || 0,
    );
    if (!(catalog > 0) || !(next > 0) || catalog === next) return null;
    return `Hoy se vende a ${this.money(catalog)}: el precio quedó desactualizado. Al guardar pasa a ${this.money(next)}.`;
  }

  unitPriceDisplay(calculatedPrice: number): string {
    const amount = this.priceManual
      ? this.pricing.manualUnitPrice!
      : calculatedPrice;
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(
      Math.round(Number(amount) || 0),
    );
  }

  onUnitPriceDisplayChange(raw: string): void {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) {
      this.resetUnitPrice();
      return;
    }
    this.pricing.applyManualUnitPrice(Math.round(Number(digits)));
    this.cdr.markForCheck();
  }

  resetUnitPrice(): void {
    this.pricing.clearManualUnitPrice();
    this.cdr.markForCheck();
  }

  unitPriceHint(calculatedPrice: number, cost: number): string {
    const calculated = Number(this.pricing.computedPrice) || calculatedPrice;
    const calculatedLabel =
      calculated > 0
        ? `Calculado ${this.money(calculated)}`
        : 'Sin precio calculado aún';
    const price = this.priceManual
      ? Number(this.pricing.manualUnitPrice) || 0
      : calculated;
    const margin =
      cost > 0 && price > 0
        ? Math.round(((price - cost) / cost) * 100)
        : null;
    if (this.priceManual && margin != null && margin < 0) {
      return `${calculatedLabel} · precio manual · margen ${margin}%`;
    }
    if (this.priceManual) {
      return `${calculatedLabel} · precio manual`;
    }
    if (margin != null) {
      return `${calculatedLabel} · margen ${margin}%`;
    }
    return calculatedLabel;
  }

  actualMarginPercent(price: number, cost: number): number | null {
    return markupPercentOnCostRounded(price, cost);
  }

  setSavings(componentsPrice: number, salePrice: number): number {
    return Math.max(0, Math.round((Number(componentsPrice) || 0) - (Number(salePrice) || 0)));
  }

  private printProfile() {
    if (!this.settings) return null;
    const preferred =
      this.form.controls.type.value === ProductType.FDM
        ? this.form.controls.preferredPrinterId.value
        : null;
    return selectPrintProfileForCost(
      this.settings,
      this.form.controls.type.value,
      preferred,
    ) ?? null;
  }

  private money(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
