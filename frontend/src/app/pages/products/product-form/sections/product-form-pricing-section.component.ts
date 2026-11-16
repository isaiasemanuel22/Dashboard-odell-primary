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
  Supply,
} from '../../../../core/models';
import { SuppliesService } from '../../../../core/services/settings.service';
import {
  resolveFilamentPricePerKg,
  resolveResinPricePerLiter,
} from '../../../../shared/utils/material-type-price.util';
import { SettingsFacade } from '../../../../store/settings/settings.facade';
import { selectPrintProfileForCost } from '../../../../shared/utils/machine-profile.util';
import { totalFdmFilamentGrams } from '../../../../shared/utils/fdm.helpers';
import {
  getMarginForProductType,
  marginLabelForProductType,
} from '../../../../shared/utils/pricing.util';
import { formatHoursEs } from '../../../../shared/utils/decimal-es.util';
import {
  DISCOUNT_PERCENT_MAX,
  DiscountMode,
  clampDiscountAmount,
  clampDiscountPercent,
  discountAmountClampMessage,
  discountModeFromValues,
  discountPercentClampMessage,
} from '../../../../shared/utils/discount.util';
import {
  productDiscountLabel,
  productSalePrice,
} from '../../../../shared/utils/product-discount.util';
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
  private readonly suppliesService = inject(SuppliesService);
  private supplies: Supply[] = [];

  @Input({ required: true }) facade!: ProductFormFacade;
  @Input({ required: true }) form!: ProductFormGroup;

  readonly vm$ = this.pricingStore.vm$;

  readonly priceModeOptions: DbSegmentOption<PriceMode>[] = [
    { value: 'calculated', label: 'Calculado' },
    { value: 'fixed', label: 'Precio fijo' },
  ];

  readonly discountSegmentOptions: DbSegmentOption<DiscountMode>[] = [
    { value: 'none', label: 'Sin' },
    { value: 'percent', label: '%' },
    { value: 'amount', label: '$' },
  ];

  discountMode: DiscountMode = 'none';
  discountNotice = '';

  ngOnInit(): void {
    this.discountMode = discountModeFromValues(
      this.form.controls.discountPercent.value ?? undefined,
      this.form.controls.discountAmount.value ?? undefined,
    );
    const stored = Number(this.form.controls.suggestedPrice.value) || 0;
    if (stored > 0) {
      this.pricing.adoptStoredManualPrice();
    }
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.cdr.markForCheck();
    });
    this.suppliesService
      .watchSupplies()
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.supplies = items;
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
    return formatHoursEs(hours);
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
    if (this.form.controls.type.value === ProductType.COMBO) return 'Combo';
    return marginLabelForProductType(this.form.controls.type.value);
  }

  get isEstampadoType(): boolean {
    return this.form.controls.type.value === ProductType.ESTAMPADO;
  }

  /** Etiquetas de las líneas de costo según el tipo de producto. */
  get materialLineLabel(): string {
    return this.isEstampadoType ? 'Impresos' : 'Material';
  }

  get energyLineLabel(): string {
    return this.isEstampadoType ? 'Luz (plancha)' : 'Luz';
  }

  get machineLineLabel(): string {
    return this.isEstampadoType ? 'Plancha' : 'Máquina';
  }

  /** Insumos y materiales sin precio: el costo mostrado queda incompleto. */
  get missingPriceItems(): string[] {
    const items: string[] = [];
    for (const line of this.form.controls.supplyLines.value ?? []) {
      if (!line.supplyId || !(Number(line.quantity) > 0)) continue;
      const supply = this.supplies.find((item) => item.id === line.supplyId);
      if (supply && !(Number(supply.unitPrice) > 0)) items.push(supply.name);
    }
    const type = this.form.controls.type.value;
    if (this.facade.usesPieceAssembly || !this.settings) return items;
    if (type === ProductType.FDM) {
      for (const line of this.form.controls.filamentLines.value ?? []) {
        if (!(Number(line.grams) > 0) || !line.filamentType) continue;
        const price = resolveFilamentPricePerKg(
          this.settings,
          line.filamentType,
          this.supplies,
        );
        if (!(Number(price) > 0)) items.push(`filamento ${line.filamentType}`);
      }
    } else if (type === ProductType.RESINA) {
      const resin = String(this.form.controls.resinType.value ?? '');
      if (resin && Number(this.form.controls.grams.value) > 0) {
        const price = resolveResinPricePerLiter(
          this.settings,
          resin,
          this.supplies,
        );
        if (!(Number(price) > 0)) items.push(`resina ${resin}`);
      }
    }
    return [...new Set(items)];
  }

  get incompleteCostNotice(): string | null {
    const items = this.missingPriceItems;
    if (!items.length) return null;
    return `Costo incompleto: falta el precio de ${items.join(', ')}. El margen real es menor al que se muestra.`;
  }

  /** Precio de venta por debajo del costo (se puede guardar, pero se avisa). */
  belowCostNotice(
    price: number,
    cost: number,
    laborCost = 0,
  ): string | null {
    if (!(price > 0) || !(cost > 0) || price >= cost) return null;
    const margin = markupPercentOnCostRounded(price, cost, laborCost);
    return `El precio de venta (${this.money(price)}) está por debajo del costo (${this.money(cost)}): margen ${margin}%. Se vende a pérdida.`;
  }

  get supplyCost(): number {
    return this.pricing.supplyValue();
  }

  /** Valor + error del insumo (para restar del total al mostrar la base del margen). */
  get supplyCostWithError(): number {
    return this.pricing.supplyCostWithError();
  }

  /** Precio de los insumos dentro del precio de venta (valor × 2 + error). */
  get supplyPrice(): number {
    return this.pricing.supplyPrice();
  }

  get priceManual(): boolean {
    return this.pricing.manualUnitPrice != null && this.pricing.manualUnitPrice > 0;
  }

  get priceMode(): PriceMode {
    return this.priceManual || this.pricing.fixedPriceMode ? 'fixed' : 'calculated';
  }

  onPriceModeChange(mode: PriceMode): void {
    if (mode === 'calculated') {
      this.resetUnitPrice();
      return;
    }
    this.pricing.fixedPriceMode = true;
    // Combo: el calculado que se ve incluye los insumos (× 2); arranca con ese.
    const calculated = Math.round(
      this.calculatedFor(Number(this.facade.finalPrice)) ||
        Number(this.facade.finalPrice) ||
        0,
    );
    const current = this.priceManual
      ? Math.round(Number(this.pricing.manualUnitPrice) || 0)
      : calculated;
    const amount = current > 0 ? current : calculated;
    if (amount > 0) {
      this.pricing.applyManualUnitPrice(amount);
    }
    this.cdr.markForCheck();
  }

  /**
   * Precio calculado que ve el usuario. En armado de piezas (combo) el interno
   * no incluye los insumos: manda el del panel, que sí.
   */
  private calculatedFor(displayedPrice: number): number {
    if (this.facade.usesPieceAssembly) {
      const parts = Number(this.pricing.computedPrice) || 0;
      return parts > 0 ? parts + this.supplyPrice : Number(displayedPrice) || 0;
    }
    return Number(this.pricing.computedPrice) || Number(displayedPrice) || 0;
  }

  /** Precio guardado que se conserva si el calculado difiere. */
  heldPrice(displayedPrice: number): number | null {
    if (this.priceManual) return null;
    const held = this.pricing.heldCatalogPrice();
    if (held == null) return null;
    const next = Math.round(
      this.calculatedFor(displayedPrice),
    );
    return next > 0 && next !== held ? held : null;
  }

  stalePriceNotice(displayedPrice: number): string | null {
    const held = this.heldPrice(displayedPrice);
    if (held == null) return null;
    const next = Math.round(
      this.calculatedFor(displayedPrice),
    );
    return `Hoy se vende a ${this.money(held)}; el precio calculado es ${this.money(next)}. Al guardar se mantiene ${this.money(held)}.`;
  }

  useCalculatedPrice(): void {
    this.pricing.acceptCalculatedPrice();
    this.cdr.markForCheck();
  }

  unitPriceDisplay(calculatedPrice: number): string {
    // Precio fijo vacío o en 0: el campo queda vacío (falta cargarlo).
    if (this.pricing.fixedPriceMissing) return '';
    const amount = this.priceManual
      ? this.pricing.manualUnitPrice!
      : (this.heldPrice(calculatedPrice) ?? calculatedPrice);
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(
      Math.round(Number(amount) || 0),
    );
  }

  /** Texto del precio unitario mientras se edita; null fuera del campo. */
  unitPriceDraft: string | null = null;

  onUnitPriceFocus(calculatedPrice: number): void {
    this.unitPriceDraft = this.unitPriceDisplay(calculatedPrice);
  }

  onUnitPriceDisplayChange(raw: string): void {
    this.unitPriceDraft = String(raw ?? '');
    const digits = this.unitPriceDraft.replace(/\D/g, '');
    // Vacío o 0: el modo sigue en «Precio fijo» y el precio pasa a faltante.
    this.pricing.applyManualUnitPrice(digits ? Math.round(Number(digits)) : 0);
    this.cdr.markForCheck();
  }

  onUnitPriceBlur(): void {
    this.unitPriceDraft = null;
    this.cdr.markForCheck();
  }

  resetUnitPrice(): void {
    // Volver a "Calculado" es una elección explícita del usuario.
    this.pricing.fixedPriceMode = false;
    this.pricing.clearManualUnitPrice();
    this.pricing.acceptCalculatedPrice();
    this.cdr.markForCheck();
  }

  unitPriceHint(
    calculatedPrice: number,
    cost: number,
    laborCost = 0,
  ): string {
    const calculated = this.calculatedFor(calculatedPrice);
    const calculatedLabel =
      calculated > 0
        ? `Calculado ${this.money(calculated)}`
        : 'Sin precio calculado aún';
    const price = this.priceManual
      ? Number(this.pricing.manualUnitPrice) || 0
      : calculated;
    const salePrice = this.salePriceFor(price);
    const margin =
      cost > 0 && salePrice > 0
        ? markupPercentOnCostRounded(salePrice, cost, laborCost)
        : null;
    if (this.hasDiscount && margin != null) {
      return `${calculatedLabel}${this.priceManual ? ' · precio manual' : ''} · margen sobre la venta ${margin}%`;
    }
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

  actualMarginPercent(
    price: number,
    cost: number,
    laborCost = 0,
  ): number | null {
    return markupPercentOnCostRounded(price, cost, laborCost);
  }

  // ── Descuento propio del producto (§16.1.2) ─────────────────────────

  /** Precio de venta = lista − descuento del formulario. */
  salePriceFor(listPrice: number): number {
    return productSalePrice({
      price: listPrice,
      discountPercent: this.form.controls.discountPercent.value,
      discountAmount: this.form.controls.discountAmount.value,
    });
  }

  get hasDiscount(): boolean {
    return (
      Number(this.form.controls.discountPercent.value) > 0 ||
      Number(this.form.controls.discountAmount.value) > 0
    );
  }

  get discountTag(): string {
    return productDiscountLabel(
      {
        discountPercent: this.form.controls.discountPercent.value,
        discountAmount: this.form.controls.discountAmount.value,
      },
      (value) => this.money(value),
    );
  }

  /** «−15 %» o «−$1.000» sin el signo, para el texto «Precio de venta $X (−Y %)». */
  discountSummary(listPrice: number): string {
    const sale = this.salePriceFor(listPrice);
    return `Precio de venta ${this.money(sale)} (${this.discountTag})`;
  }

  get discountValueDisplay(): string {
    const value =
      this.discountMode === 'percent'
        ? this.form.controls.discountPercent.value
        : this.form.controls.discountAmount.value;
    return Number(value) > 0 ? String(value) : '';
  }

  onDiscountModeChange(mode: DiscountMode): void {
    this.discountMode = mode;
    this.discountNotice = '';
    if (mode !== 'percent') this.form.controls.discountPercent.setValue(null);
    if (mode !== 'amount') this.form.controls.discountAmount.setValue(null);
    this.form.markAsDirty();
    this.cdr.markForCheck();
  }

  onDiscountInput(input: HTMLInputElement, listPrice: number): void {
    const raw = input.value;
    const parsed = Number(String(raw ?? '').replace(',', '.'));
    const hasValue = String(raw ?? '').trim() !== '' && Number.isFinite(parsed);
    this.discountNotice = '';
    if (this.discountMode === 'percent') {
      this.form.controls.discountAmount.setValue(null);
      if (!hasValue || parsed <= 0) {
        this.form.controls.discountPercent.setValue(null);
      } else {
        const clamped = clampDiscountPercent(parsed);
        this.form.controls.discountPercent.setValue(clamped);
        if (clamped !== parsed) {
          this.discountNotice = discountPercentClampMessage(parsed);
          input.value = String(clamped);
        }
      }
    } else if (this.discountMode === 'amount') {
      this.form.controls.discountPercent.setValue(null);
      if (!hasValue || parsed <= 0) {
        this.form.controls.discountAmount.setValue(null);
      } else {
        const clamped = Math.round(clampDiscountAmount(parsed, listPrice));
        this.form.controls.discountAmount.setValue(clamped > 0 ? clamped : null);
        if (clamped !== Math.round(parsed)) {
          this.discountNotice = discountAmountClampMessage(parsed, listPrice);
          input.value = String(clamped);
        }
      }
    }
    this.form.markAsDirty();
    this.cdr.markForCheck();
  }

  readonly discountPercentMax = DISCOUNT_PERCENT_MAX;

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
