import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  DbCheckboxComponent,
  DbIconTrashComponent,
  DbInputComponent,
  DbSelectComponent,
} from '@general-components';
import {
  resolveOrderQuoteCureMinutes,
  resolveOrderQuoteWashMinutes,
} from '../../../../components/order-quote-composition.util';
import { DbSelectOption } from '../../../../components/dashboard-form/db-select/db-select.types';
import { OrderQuote3dCompositionComponent } from './order-quote-3d-composition/order-quote-3d-composition.component';
import { OrderQuoteDesignCompositionComponent } from './order-quote-design-composition/order-quote-design-composition.component';
import { OrderQuoteEstampadoCompositionComponent } from './order-quote-estampado-composition/order-quote-estampado-composition.component';
import {
  CostBreakdown,
  FdmFilamentLine,
  FilamentType,
  GeneralSettings,
  ImpresoWithCost,
  OrderLineDraft,
  PaperType,
  Product,
  ProductType,
  ServiceProfitMargins,
  ServiceType,
  Supply,
} from '../../../../core/models';
import { ImpresosService } from '../../../../core/services/impresos.service';
import { ProductCostCalculationService } from '../../../../core/services/product-cost-calculation.service';
import { SuppliesService } from '../../../../core/services/settings.service';
import { SettingsFacade } from '../../../../store/settings/settings.facade';
import { FormDialogService } from '../../../../shared/form-dialogs/public-api';
import { SERVICE_TYPE_LABELS } from '../../../../shared/constants/labels';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import {
  applyImpresoToDesignLine,
  syncDesignPrintPricing,
} from '../../../../shared/utils/design-print.util';
import {
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
  printQuantity,
  resolvePrintDimensions,
  totalEstampadoPressMinutes,
} from '../../../../shared/utils/estampado.helpers';
import {
  createEmptyFdmFilamentLine,
  normalizeFdmFilaments,
} from '../../../../shared/utils/fdm.helpers';
import { calculateMachineOverhead } from '../../../../shared/utils/machine-profile.util';
import {
  calculateLinePriceTotal,
  isDesignService,
  isGraphicDesignService,
  isLineBlank,
  lineConceptError as orderLineConceptError,
  lineQuantityError as orderLineQuantityError,
  lineUnitPriceError as orderLineUnitPriceError,
  orderLineStockHint,
  productMatchesServiceType,
} from '../../../../shared/utils/order.helpers';
import {
  applyProductSpecsToEstampadoLine,
  estampadoMargin,
  isEstampadoLine,
  isEstampadoQuoteConfigured,
  shouldShowEstampadoQuoteFields,
  syncEstampadoQuotePricing,
} from '../../../../shared/utils/order-estampado-quote.util';
import {
  applyProductSpecsToFdmLine,
  impresion3DMargin,
  isFdmQuoteConfigured,
  isImpresion3DLine,
  isResinQuoteConfigured,
  isResinQuoteLine,
  shouldShowFdmQuoteFields,
  syncFdmQuotePricing,
} from '../../../../shared/utils/order-fdm-quote.util';
import { defaultPricedResinTypeCode } from '../../../../shared/utils/resin-type.util';
import {
  getMarginForService,
  priceFromCostAndMargin,
} from '../../../../shared/utils/pricing.util';
import {
  productComponentSelectLabel,
  resolveProductUnitCost,
} from '../../../../shared/utils/product.helpers';
import { combineLatest } from 'rxjs';

export type OrderFormLineVariant = 'quote' | 'order';

@Component({
  selector: 'app-order-form-line',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    DbInputComponent,
    DbSelectComponent,
    DbCheckboxComponent,
    DbIconTrashComponent,
    CurrencyArsPipe,
    OrderQuote3dCompositionComponent,
    OrderQuoteEstampadoCompositionComponent,
    OrderQuoteDesignCompositionComponent,
  ],
  templateUrl: './order-form-line.component.html',
  styleUrl: './order-form-line.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderFormLineComponent implements OnInit {
  readonly ServiceType = ServiceType;

  private readonly settingsFacade = inject(SettingsFacade);
  private readonly costCalculator = inject(ProductCostCalculationService);
  private readonly suppliesService = inject(SuppliesService);
  private readonly impresosService = inject(ImpresosService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) line!: OrderLineDraft;
  @Input({ required: true }) lineIndex!: number;
  @Input() variant: OrderFormLineVariant = 'order';
  @Input() products: Product[] = [];
  @Input() serviceTypeOptions: Array<{ value: ServiceType; label: string }> = [];
  @Input() paperTypeOptions: DbSelectOption[] = [];

  @Output() remove = new EventEmitter<void>();
  @Output() linkPrintChange = new EventEmitter<boolean>();
  @Output() changed = new EventEmitter<void>();

  /** Solo quote: colapso local. */
  collapsed = false;

  private generalSettings: GeneralSettings | null = null;
  private profitMargins: ServiceProfitMargins | null = null;
  private supplies: Supply[] = [];
  private impresos: ImpresoWithCost[] = [];

  ngOnInit(): void {
    combineLatest([
      this.settingsFacade.watchGeneralSettings(),
      this.settingsFacade.profitMargins$,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([settings, margins]) => {
        this.generalSettings = settings;
        this.profitMargins = margins;
        this.cdr.markForCheck();
      });

    this.suppliesService
      .watchSupplies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.supplies = items;
        this.cdr.markForCheck();
      });

    this.impresosService
      .getImpresos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.impresos = items;
        this.cdr.markForCheck();
      });
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.cdr.markForCheck();
  }

  // ── Display helpers ──────────────────────────────────────────────

  get lineTitle(): string {
    return (
      this.line.customName?.trim() ||
      this.product?.name ||
      `Línea ${this.lineIndex + 1}`
    );
  }

  get lineCollapsedDetail(): string {
    const qty = Math.max(1, Number(this.line.quantity) || 1);
    const parts = [`${qty} × ${this.money(this.unitPriceForLine)}`];
    if (isImpresion3DLine(this.line.serviceType)) {
      const breakdown = this.fdmBreakdown();
      if (breakdown) {
        parts.push(`Filamento ${this.money(breakdown.materialCost)}`);
        parts.push(
          `Impresión ${this.money(breakdown.energyCost + breakdown.machineCost)}`,
        );
      }
    } else if (isEstampadoLine(this.line.serviceType)) {
      const costs = this.estampadoCosts();
      parts.push(`Impresos ${this.money(costs.prints)}`);
      parts.push(`Insumos ${this.money(costs.supplies)}`);
      parts.push(`Plancha ${this.money(costs.press)}`);
    }
    return parts.join(' · ');
  }

  get serviceLabel(): string {
    return SERVICE_TYPE_LABELS[this.line.serviceType];
  }

  get accentClass(): string {
    return `order-line--accent-${this.line.serviceType}`;
  }

  get productFieldLabel(): string {
    return this.line.serviceType === ServiceType.ESTAMPADO
      ? 'Impreso'
      : 'Producto';
  }

  servicePillModifier(type: ServiceType): string {
    return `service-pill--${type}`;
  }

  get productOptions(): DbSelectOption[] {
    const options = this.products
      .filter((p) => productMatchesServiceType(p, this.line.serviceType))
      .map((p) => ({
        value: p.id,
        label: productComponentSelectLabel(p),
      }));

    if (
      isImpresion3DLine(this.line.serviceType) ||
      isEstampadoLine(this.line.serviceType)
    ) {
      options.unshift({
        value: '',
        label: 'Presupuesto manual (sin catálogo)',
      });
    }

    if (
      this.line.productId &&
      !options.some((o) => o.value === this.line.productId)
    ) {
      const current = this.products.find((p) => p.id === this.line.productId);
      if (current) {
        options.unshift({
          value: current.id,
          label: productComponentSelectLabel(current),
        });
      }
    }

    return options;
  }

  get impresoOptions(): DbSelectOption[] {
    const paperType = this.line.printPaperType;
    return this.impresos
      .filter((item) => !paperType || item.paperType === paperType)
      .map((item) => ({
        value: item.id,
        label: item.name,
      }));
  }

  get product(): Product | null {
    return this.line.productId
      ? (this.products.find((p) => p.id === this.line.productId) ?? null)
      : null;
  }

  get conceptError(): string {
    if (isLineBlank(this.line)) return '';
    return orderLineConceptError(this.line);
  }

  get quantityError(): string {
    if (isLineBlank(this.line)) return '';
    return orderLineQuantityError(this.line.quantity);
  }

  get unitPriceError(): string {
    if (isLineBlank(this.line)) return '';
    return orderLineUnitPriceError(this.line);
  }

  get unitCost(): number {
    if (
      isEstampadoLine(this.line.serviceType) &&
      isEstampadoQuoteConfigured(this.line)
    ) {
      if (this.line.unitCost != null && this.line.unitCost > 0) {
        return this.line.unitCost;
      }
      const est = this.estampadoCosts();
      const fromBreakdown =
        est.prints +
        est.supplies +
        est.press +
        est.labor +
        est.errorMargin;
      if (fromBreakdown > 0) return fromBreakdown;
    }
    if (this.line.unitCost != null && this.line.unitCost >= 0) {
      return this.line.unitCost;
    }
    return this.productUnitCost();
  }

  get unitCostFormatted(): string {
    const cost = isDesignService(this.line.serviceType)
      ? Number(this.line.unitCost) || 0
      : this.unitCost;
    if (this.variant === 'quote' || isDesignService(this.line.serviceType)) {
      return this.plainAmount(cost);
    }
    return this.money(cost);
  }

  get unitCostHint(): string {
    if (isDesignService(this.line.serviceType)) {
      return isGraphicDesignService(this.line.serviceType)
        ? 'Sin costo de material'
        : this.designCostHint;
    }
    if (this.variant === 'quote') {
      if (isEstampadoLine(this.line.serviceType)) {
        return 'Calculado: impresos + insumos + plancha';
      }
      if (isImpresion3DLine(this.line.serviceType)) {
        return 'Calculado: material + impresión + mano de obra + error';
      }
      return 'Calculado desde el formulario';
    }
    if (isEstampadoLine(this.line.serviceType)) return this.estampadoPricingHint;
    if (isImpresion3DLine(this.line.serviceType)) return this.fdmPricingHint;
    return 'Calculado con material, luz y máquina';
  }

  get priceHint(): string {
    if (isDesignService(this.line.serviceType)) return this.designPriceHint;
    return this.variant === 'quote'
      ? this.suggestedUnitPriceHint
      : this.unitPriceHint;
  }

  get priceHintWarn(): boolean {
    if (isDesignService(this.line.serviceType)) {
      return this.serviceRate <= 0 || this.isUnitPriceBelowCost;
    }
    return this.isUnitPriceBelowCost;
  }

  get designUnitPrice(): number {
    return this.line.designUnitPrice ?? this.line.unitPrice;
  }

  get lineTotal(): number {
    return calculateLinePriceTotal(this.line);
  }

  get stockHint(): string | null {
    const product = this.products.find((p) => p.id === this.line.productId);
    return orderLineStockHint(this.line, product, this.products);
  }

  get isUnitPriceManual(): boolean {
    return !!this.line.unitPriceManual;
  }

  get isUnitPriceBelowCost(): boolean {
    const cost = this.unitCost;
    if (!(cost > 0)) return false;
    const price = isDesignService(this.line.serviceType)
      ? this.designUnitPrice
      : Number(this.line.unitPrice) || 0;
    return price > 0 && price < cost;
  }

  get designCostHint(): string {
    const hours = Number(this.line.budgetedHours) || 0;
    const rateLabel = isGraphicDesignService(this.line.serviceType)
      ? 'tarifa de diseño'
      : 'tarifa de modelado';
    return `${this.formatNumber(hours)} h × ${rateLabel}`;
  }

  get designPriceHint(): string {
    if (this.serviceRate <= 0) {
      const rateLabel = isGraphicDesignService(this.line.serviceType)
        ? 'Tarifa de diseño'
        : 'Tarifa de modelado';
      return `${rateLabel} en $ 0: el sugerido no se calcula`;
    }
    return this.unitPriceAnnotation();
  }

  get suggestedUnitPriceHint(): string {
    return this.unitPriceAnnotation();
  }

  get unitPriceHint(): string {
    const annotation = this.unitPriceAnnotation();
    if (this.line.productId && !this.line.unitPriceManual) {
      return `${annotation} · precio de lista del catálogo`;
    }
    return annotation;
  }

  get fdmPricingHint(): string {
    if (this.isCatalogLocked) {
      return 'Costo calculado con los datos del producto (solo lectura).';
    }
    return 'Presupuesto calculado según configuración de costos y margen de Impresión 3D.';
  }

  get estampadoPricingHint(): string {
    if (this.isCatalogLocked) {
      return 'Costo calculado con los datos del producto (solo lectura).';
    }
    return 'Presupuesto calculado con insumos, impresos y bajadas + margen de Estampado.';
  }

  get serviceRate(): number {
    if (!this.generalSettings) return 0;
    if (isGraphicDesignService(this.line.serviceType)) {
      return this.generalSettings.graphicDesignRatePerHour ?? 0;
    }
    if (this.line.serviceType === ServiceType.MODELADO) {
      return this.generalSettings.modelingRatePerHour ?? 0;
    }
    return 0;
  }

  get isCatalogLocked(): boolean {
    return !!this.line.productId?.trim();
  }

  get usePlainCostPrefix(): boolean {
    return this.variant === 'quote' || this.isDesign();
  }

  get unitPriceForLine(): number {
    return isDesignService(this.line.serviceType)
      ? this.designUnitPrice
      : Number(this.line.unitPrice) || 0;
  }

  plainAmount(value: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(
      Number(value) || 0,
    );
  }

  // ── Type / visibility ────────────────────────────────────────────

  isDesign(): boolean {
    return isDesignService(this.line.serviceType);
  }

  isGraphic(): boolean {
    return isGraphicDesignService(this.line.serviceType);
  }

  isEstampado(): boolean {
    return isEstampadoLine(this.line.serviceType);
  }

  isImpresion3D(): boolean {
    return isImpresion3DLine(this.line.serviceType);
  }

  showFdm(): boolean {
    return shouldShowFdmQuoteFields(this.line, this.product ?? undefined);
  }

  isResinProcess(): boolean {
    return isResinQuoteLine(this.line, this.product ?? undefined);
  }

  showEstampado(): boolean {
    return shouldShowEstampadoQuoteFields(this.line, this.product ?? undefined);
  }

  setPrintProcess(process: 'fdm' | 'resina'): void {
    if (this.line.productId?.trim()) return;
    if (this.line.printProcess === process) return;
    this.line.printProcess = process;
    if (process === 'resina') {
      this.line.filaments = undefined;
      this.line.filamentType = undefined;
      if (!this.line.resinType) {
        this.line.resinType = defaultPricedResinTypeCode(this.generalSettings);
      }
      this.line.washMinutes ??= 0;
      this.line.cureMinutes ??= 0;
    } else {
      this.line.resinType = undefined;
      this.line.washMinutes = undefined;
      this.line.cureMinutes = undefined;
    }
    this.emitChanged();
    this.cdr.markForCheck();
  }

  // ── Mutations ────────────────────────────────────────────────────

  onConceptChange(value: string): void {
    this.line.customName = value;
    this.line.conceptManual = true;
    this.emitChanged();
  }

  onProductChange(productId: string): void {
    this.line.productId = productId ?? '';

    const product = this.line.productId
      ? this.products.find((p) => p.id === this.line.productId)
      : undefined;

    if (product && !this.line.conceptManual) {
      this.line.customName = product.name;
    }

    if (product?.type === ProductType.RESINA) {
      this.line.printProcess = 'resina';
      this.line.resinType = product.resinType;
      this.line.filaments = undefined;
      this.line.filamentType = undefined;
      this.line.washMinutes = Number(product.washMinutes) || 0;
      this.line.cureMinutes = Number(product.cureMinutes) || 0;
    } else if (product && isImpresion3DLine(this.line.serviceType)) {
      this.line.printProcess = 'fdm';
      this.line.resinType = undefined;
      this.line.washMinutes = undefined;
      this.line.cureMinutes = undefined;
    }

    if (!product) {
      this.line.unitPrice = 0;
      this.line.unitCost = undefined;
      if (isImpresion3DLine(this.line.serviceType) && !this.line.printProcess) {
        this.line.printProcess = 'fdm';
      }
      if (isEstampadoLine(this.line.serviceType)) {
        this.line.estampadoPrints ??= [];
        this.line.estampadoPressCycles ??= [];
        this.line.estampadoSupplies ??= [];
        this.syncEstampadoLine({ preservePrice: false });
      }
      if (isImpresion3DLine(this.line.serviceType)) {
        if (this.line.filaments?.length) {
          this.line.filaments = normalizeFdmFilaments(this.line.filaments);
        } else {
          this.quoteFilaments();
        }
        this.syncFdmLine({ preservePrice: false });
      }
      this.emitChanged();
      return;
    }

    applyProductSpecsToFdmLine(this.line, product, this.products);
    applyProductSpecsToEstampadoLine(this.line, product);
    if (isImpresion3DLine(this.line.serviceType)) {
      this.syncFdmLine({ preservePrice: false });
      this.applyCatalogListPrice(product);
      this.emitChanged();
      return;
    }
    if (isEstampadoLine(this.line.serviceType)) {
      this.syncEstampadoLine({ preservePrice: false });
      this.applyCatalogListPrice(product);
      this.emitChanged();
      return;
    }

    this.applyCatalogListPrice(product);
    this.emitChanged();
  }

  onUnitPriceChange(raw: number | string): void {
    const price = Number(raw) || 0;
    this.line.unitPrice = price;
    if (price !== 0) {
      this.line.unitPriceManual = true;
    } else {
      this.line.unitPriceManual = undefined;
    }
    if (isDesignService(this.line.serviceType)) {
      this.line.designUnitPrice = this.line.unitPrice;
    }
    this.emitChanged();
  }

  onDesignUnitPriceChange(raw: number | string): void {
    const price = Number(raw) || 0;
    this.line.designUnitPrice = price;
    this.line.unitPrice = price;
    if (price !== 0) {
      this.line.unitPriceManual = true;
    } else {
      this.line.unitPriceManual = undefined;
    }
    this.line.unitCost = this.designServiceCost();
    this.syncDesignPrintLine();
    this.emitChanged();
  }

  resetUnitPriceToSuggested(): void {
    this.line.unitPriceManual = undefined;

    if (isDesignService(this.line.serviceType)) {
      const suggested = this.calculatedUnitPrice();
      this.line.designUnitPrice = suggested;
      this.line.unitPrice = suggested;
      this.line.unitCost = this.designServiceCost();
      this.syncDesignPrintLine();
      this.emitChanged();
      return;
    }

    if (isImpresion3DLine(this.line.serviceType)) {
      this.syncFdmLine({ preservePrice: false });
      const product = this.product ?? undefined;
      if (product) this.applyCatalogListPrice(product);
      this.emitChanged();
      return;
    }

    if (isEstampadoLine(this.line.serviceType)) {
      this.syncEstampadoLine({ preservePrice: false });
      const product = this.product ?? undefined;
      if (product) this.applyCatalogListPrice(product);
    }
    this.emitChanged();
  }

  onFdmQuoteChange(): void {
    this.syncFdmLine({ preservePrice: !!this.line.unitPriceManual });
    this.emitChanged();
  }

  onEstampadoQuoteChange(): void {
    this.syncEstampadoLine({ preservePrice: !!this.line.unitPriceManual });
    this.emitChanged();
  }

  onDesignCompositionChanged(): void {
    this.syncDesignPrintLine();
    this.emitChanged();
  }

  onLinkPrintFromComposition(checked: boolean): void {
    this.linkPrintChange.emit(checked);
    this.emitChanged();
  }

  onIncludesPrintChange(checked: boolean): void {
    this.line.includesPrint = checked;
    if (checked) {
      this.line.designUnitPrice ??= this.line.unitPrice;
      this.line.printPaperType ??= PaperType.DTF;
      this.line.printImpresoId ??= '';
    } else {
      this.line.unitPrice = this.line.designUnitPrice ?? this.line.unitPrice;
      this.line.printPaperType = undefined;
      this.line.printWidthCm = undefined;
      this.line.printLengthCm = undefined;
      this.line.printImpresoId = undefined;
      this.line.printUnitCost = undefined;
      this.line.printUnitPrice = undefined;
    }
    this.syncDesignPrintLine();
    this.emitChanged();
  }

  onPrintPaperTypeChange(): void {
    this.line.printImpresoId = '';
    this.syncDesignPrintLine();
    this.emitChanged();
  }

  onPrintImpresoChange(): void {
    applyImpresoToDesignLine(this.line, this.impresos);
    this.syncDesignPrintLine();
    this.emitChanged();
  }

  onPrintDimensionsChange(): void {
    this.line.printImpresoId = '';
    this.syncDesignPrintLine();
    this.emitChanged();
  }

  onQuantityChange(): void {
    this.emitChanged();
  }

  setLineService(serviceType: ServiceType): void {
    if (this.line.serviceType === serviceType) return;

    if (!this.lineHasResettableData()) {
      this.applyLineService(serviceType);
      return;
    }

    this.formDialogs
      .openConfirm({
        title: 'Cambiar servicio',
        message: this.serviceChangeConfirmMessage(serviceType),
        confirmLabel: 'Cambiar servicio',
        cancelLabel: 'Cancelar',
        confirmVariant: 'primary',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.applyLineService(serviceType);
      });
  }

  // ── Private: service change ──────────────────────────────────────

  private applyLineService(serviceType: ServiceType): void {
    const hadLinkPrint = !!this.line.linkPrint;
    this.line.serviceType = serviceType;
    this.onLineServiceChange();
    if (hadLinkPrint) {
      this.linkPrintChange.emit(false);
    }
    this.emitChanged();
  }

  private onLineServiceChange(): void {
    this.line.productId = isDesignService(this.line.serviceType) ? undefined : '';
    this.line.customName = isDesignService(this.line.serviceType) ? '' : undefined;
    this.line.conceptManual = undefined;
    this.line.unitPriceManual = undefined;
    this.line.unitCost = isDesignService(this.line.serviceType) ? 0 : undefined;
    this.line.unitPrice = 0;
    this.line.budgetedHours = isDesignService(this.line.serviceType) ? 0 : undefined;
    this.line.printTimeHours = undefined;
    this.line.grams = undefined;
    this.line.filamentType = undefined;
    this.line.estampadoPrints = isEstampadoLine(this.line.serviceType)
      ? []
      : undefined;
    this.line.estampadoPressCycles = isEstampadoLine(this.line.serviceType)
      ? []
      : undefined;
    this.line.estampadoSupplies = isEstampadoLine(this.line.serviceType)
      ? []
      : undefined;
    if (!isGraphicDesignService(this.line.serviceType)) {
      this.line.includesPrint = false;
      this.line.printPaperType = undefined;
      this.line.printWidthCm = undefined;
      this.line.printLengthCm = undefined;
      this.line.printImpresoId = undefined;
      this.line.printUnitCost = undefined;
      this.line.printUnitPrice = undefined;
    }
    this.line.designUnitPrice = undefined;
    this.line.filaments = undefined;
    this.line.workTimeHours = undefined;
    this.line.laborNote = undefined;
    this.line.workKind = undefined;
    this.line.deliverables = undefined;
    this.line.includesRevisions = undefined;
    this.line.needsClientProduct = undefined;
    this.line.linkPrint = undefined;
    if (isDesignService(this.line.serviceType)) {
      this.line.chargeMode = isGraphicDesignService(this.line.serviceType)
        ? 'fixed'
        : 'hours';
      this.applyDesignBudget();
    } else {
      this.line.chargeMode = undefined;
    }
  }

  private lineHasResettableData(): boolean {
    const line = this.line;
    if (line.productId?.trim()) return true;
    if (line.customName?.trim()) return true;
    if ((Number(line.unitPrice) || 0) > 0) return true;
    if ((Number(line.unitCost) || 0) > 0) return true;
    if ((Number(line.designUnitPrice) || 0) > 0) return true;
    if ((Number(line.budgetedHours) || 0) > 0) return true;
    if ((Number(line.printTimeHours) || 0) > 0) return true;
    if ((Number(line.grams) || 0) > 0) return true;
    if ((Number(line.workTimeHours) || 0) > 0) return true;
    if (line.laborNote?.trim()) return true;
    if (line.workKind?.trim()) return true;
    if (line.deliverables?.length) return true;
    if (line.includesPrint) return true;
    if (line.includesRevisions) return true;
    if (line.needsClientProduct) return true;
    if (line.linkPrint) return true;
    if (line.filaments?.some((f) => (Number(f.grams) || 0) > 0)) return true;
    if (
      line.estampadoPrints?.some(
        (p) =>
          (Number(p.widthCm) || 0) > 0 ||
          (Number(p.lengthCm) || 0) > 0 ||
          (Number(p.heightCm) || 0) > 0 ||
          (Number(p.quantity) || 0) > 1 ||
          !!p.impresoId,
      )
    ) {
      return true;
    }
    if (
      line.estampadoPressCycles?.some(
        (c) =>
          (Number(c.pressMinutes) || 0) > 0 || (Number(c.bajadas) || 0) > 0,
      )
    ) {
      return true;
    }
    if (
      line.estampadoSupplies?.some(
        (s) => !!s.supplyId || (Number(s.quantity) || 0) > 0,
      )
    ) {
      return true;
    }
    return false;
  }

  private serviceChangeConfirmMessage(next: ServiceType): string {
    const line = this.line;
    const lost: string[] = [];
    if (line.productId?.trim() || line.customName?.trim()) {
      lost.push('concepto o producto');
    }
    if (
      (Number(line.grams) || 0) > 0 ||
      line.filaments?.some((f) => (Number(f.grams) || 0) > 0)
    ) {
      lost.push('gramos y materiales');
    }
    if ((Number(line.printTimeHours) || 0) > 0) {
      lost.push('horas de impresión');
    }
    if ((Number(line.workTimeHours) || 0) > 0 || line.laborNote?.trim()) {
      lost.push('mano de obra');
    }
    if ((Number(line.budgetedHours) || 0) > 0) {
      lost.push('horas presupuestadas');
    }
    const hasEstampadoData =
      line.estampadoPrints?.some(
        (p) =>
          (Number(p.widthCm) || 0) > 0 ||
          (Number(p.lengthCm) || 0) > 0 ||
          (Number(p.heightCm) || 0) > 0 ||
          (Number(p.quantity) || 0) > 1 ||
          !!p.impresoId,
      ) ||
      line.estampadoPressCycles?.some(
        (c) =>
          (Number(c.pressMinutes) || 0) > 0 || (Number(c.bajadas) || 0) > 0,
      ) ||
      line.estampadoSupplies?.some(
        (s) => !!s.supplyId || (Number(s.quantity) || 0) > 0,
      );
    if (hasEstampadoData) {
      lost.push('medidas e insumos de estampado');
    }
    if (
      line.workKind?.trim() ||
      line.deliverables?.length ||
      line.includesPrint ||
      line.includesRevisions ||
      line.needsClientProduct
    ) {
      lost.push('detalle de diseño o modelado');
    }
    if (
      (Number(line.unitPrice) || 0) > 0 ||
      (Number(line.designUnitPrice) || 0) > 0
    ) {
      lost.push('precio');
    }

    const detail =
      lost.length > 0
        ? ` Se van a borrar: ${lost.join(', ')}.`
        : ' Se van a borrar los datos cargados en esta línea.';

    return `Al cambiar a «${SERVICE_TYPE_LABELS[next]}» la línea se reinicia.${detail} ¿Continuar?`;
  }

  // ── Private: pricing / sync ──────────────────────────────────────

  private applyCatalogListPrice(product: Product): void {
    if (Number(product.price) > 0) {
      this.line.unitPrice = product.price;
      this.line.unitPriceManual = undefined;
    }
    if (!(Number(this.line.unitCost) > 0) && Number(product.cost) > 0) {
      this.line.unitCost = product.cost;
    }
  }

  quoteFilaments(): FdmFilamentLine[] {
    if (!this.line.filaments?.length) {
      const restored = normalizeFdmFilaments(undefined, {
        grams: this.line.grams,
        filamentType: this.line.filamentType,
      });
      this.line.filaments = restored.length
        ? restored
        : [createEmptyFdmFilamentLine(this.line.filamentType ?? FilamentType.PLA)];
    }
    return this.line.filaments;
  }

  private calculatedUnitPrice(): number {
    if (!this.profitMargins) return 0;
    const cost = this.unitCost;
    if (!(cost > 0)) return 0;
    if (isDesignService(this.line.serviceType)) {
      return priceFromCostAndMargin(cost, this.designMarginFor());
    }
    const margin = isEstampadoLine(this.line.serviceType)
      ? estampadoMargin(this.profitMargins)
      : impresion3DMargin(this.profitMargins);
    return priceFromCostAndMargin(cost, margin);
  }

  private unitPriceAnnotation(): string {
    const calculated = this.calculatedUnitPrice();
    const calculatedLabel =
      calculated > 0
        ? `Calculado ${this.money(calculated)}`
        : this.profitMargins
          ? 'Sin precio calculado aún'
          : 'Cargando Ajustes…';

    const cost = this.unitCost;
    const price = isDesignService(this.line.serviceType)
      ? this.designUnitPrice
      : Number(this.line.unitPrice) || 0;
    const marginPercent =
      cost > 0 && price > 0
        ? Math.round(((price - cost) / cost) * 100)
        : null;

    if (marginPercent != null && marginPercent < 0) {
      return this.line.unitPriceManual
        ? `${calculatedLabel} · precio manual · margen ${marginPercent}%`
        : `${calculatedLabel} · margen ${marginPercent}%`;
    }

    if (this.line.unitPriceManual) {
      return `${calculatedLabel} · precio manual`;
    }

    if (!this.profitMargins) return calculatedLabel;

    if (marginPercent != null) {
      return `${calculatedLabel} · margen ${marginPercent}%`;
    }

    if (
      isEstampadoLine(this.line.serviceType) ||
      isImpresion3DLine(this.line.serviceType)
    ) {
      const margin = isEstampadoLine(this.line.serviceType)
        ? estampadoMargin(this.profitMargins)
        : impresion3DMargin(this.profitMargins);
      return calculated > 0
        ? `${calculatedLabel} (costo + ${margin}%)`
        : calculatedLabel;
    }

    return calculatedLabel;
  }

  private get errorMarginPercent(): number {
    return Math.min(
      Math.max(Number(this.generalSettings?.errorMarginPercent) || 0, 0),
      100,
    );
  }

  private isResinProductLine(): boolean {
    return isResinQuoteLine(this.line, this.product ?? undefined);
  }

  private fdmBreakdown(): CostBreakdown | null {
    if (!this.generalSettings) return null;
    const product = this.product ?? undefined;
    const isResin = this.isResinProductLine();
    const resinType =
      product && 'resinType' in product && product.resinType
        ? product.resinType
        : this.line.resinType;
    const resinReady =
      isResin &&
      !!resinType &&
      ((Number(this.line.grams) || 0) > 0 ||
        (Number(this.line.printTimeHours) || 0) > 0);
    if (!isResin && !isFdmQuoteConfigured(this.line)) return null;
    if (isResin && !resinReady) return null;

    const filamentsForQuote = isResin
      ? undefined
      : (this.line.filaments ?? []).map((row) => ({ ...row, brand: undefined }));

    return this.costCalculator.calculateCost(
      {
        type: isResin ? ProductType.RESINA : ProductType.FDM,
        grams: Number(this.line.grams) || 0,
        printTimeHours: Number(this.line.printTimeHours) || 0,
        workTimeHours: Number(this.line.workTimeHours) || 0,
        filamentType: isResin
          ? undefined
          : (this.line.filamentType as FilamentType),
        filaments: filamentsForQuote?.length ? filamentsForQuote : undefined,
        brand:
          isResin && product && 'brand' in product ? product.brand : undefined,
        resinType: isResin ? resinType : undefined,
        washMinutes: isResin
          ? resolveOrderQuoteWashMinutes(this.line, product)
          : undefined,
        cureMinutes: isResin
          ? resolveOrderQuoteCureMinutes(this.line, product)
          : undefined,
      },
      {
        settings: this.generalSettings,
        supplies: this.supplies.length ? this.supplies : undefined,
      },
    );
  }

  private estampadoCosts(): {
    prints: number;
    supplies: number;
    press: number;
    labor: number;
    errorMargin: number;
    pressMinutes: number;
    energy: number;
    machine: number;
  } {
    const settings = this.generalSettings;
    const pressMinutes = totalEstampadoPressMinutes(
      this.line.estampadoPressCycles,
    );
    if (!settings) {
      return {
        prints: 0,
        supplies: 0,
        press: 0,
        labor: 0,
        errorMargin: 0,
        pressMinutes,
        energy: 0,
        machine: 0,
      };
    }
    const prints = normalizeEstampadoPrints(this.line.estampadoPrints).reduce(
      (sum, print) => {
        const dims = resolvePrintDimensions(print, (id) =>
          this.impresos.find((item) => item.id === id),
        );
        if (!dims) return sum;
        return (
          sum +
          this.costCalculator.calculateImpresoPaperCost(
            settings,
            dims.paperType,
            dims.widthCm,
            dims.heightCm,
          ) *
            printQuantity(print)
        );
      },
      0,
    );
    const supplies = normalizeEstampadoSupplies(
      this.line.estampadoSupplies,
    ).reduce((sum, entry) => {
      const supply = this.supplies.find((item) => item.id === entry.supplyId);
      return supply
        ? sum + (Number(supply.unitPrice) || 0) * (Number(entry.quantity) || 0)
        : sum;
    }, 0);
    const overhead = calculateMachineOverhead(settings, ProductType.ESTAMPADO, {
      printTimeHours: 0,
      pressMinutes,
    });
    const labor = Math.round(
      (Number(this.line.workTimeHours) || 0) *
        (Number(settings.laborCostPerHour) || 0),
    );
    const percent = this.errorMarginPercent;
    const errorMargin = percent
      ? Math.round(
          (prints + supplies + overhead.energyCost + overhead.machineCost) *
            (percent / 100),
        )
      : 0;
    return {
      prints: Math.round(prints),
      supplies: Math.round(supplies),
      press: overhead.energyCost + overhead.machineCost,
      labor,
      errorMargin,
      pressMinutes,
      energy: overhead.energyCost,
      machine: overhead.machineCost,
    };
  }

  private productUnitCost(): number {
    const product = this.products.find((p) => p.id === this.line.productId);
    return resolveProductUnitCost(product, this.products);
  }

  private chargeModeFor(): 'hours' | 'fixed' {
    if (this.line.chargeMode) return this.line.chargeMode;
    return isGraphicDesignService(this.line.serviceType) ? 'fixed' : 'hours';
  }

  private designMarginFor(): number {
    if (!this.profitMargins) return 0;
    return getMarginForService(this.line.serviceType, this.profitMargins);
  }

  private designServiceCost(): number {
    if (this.chargeModeFor() === 'fixed') return 0;
    const hours = Math.max(0, Number(this.line.budgetedHours) || 0);
    return Math.round(this.serviceRate * hours);
  }

  private applyDesignBudget(): void {
    if (!this.profitMargins) return;
    const hours = Math.max(0, Number(this.line.budgetedHours) || 0);
    this.line.budgetedHours = hours;
    const cost = this.designServiceCost();
    this.line.unitCost = cost;
    const price = priceFromCostAndMargin(cost, this.designMarginFor());
    this.line.unitPrice = price;
    this.line.designUnitPrice = price;
    this.syncDesignPrintLine();
  }

  private syncFdmLine(options?: {
    preservePrice?: boolean;
    preserveCost?: boolean;
  }): void {
    if (!this.generalSettings || !this.profitMargins) return;

    const product = this.product ?? undefined;
    const isResin = this.isResinProductLine();
    const resinType =
      product && 'resinType' in product && product.resinType
        ? product.resinType
        : this.line.resinType;
    const resinConfigured =
      isResin &&
      isResinQuoteConfigured({
        ...this.line,
        resinType,
        printProcess: isResin ? 'resina' : this.line.printProcess,
      });
    const configured =
      (!isResin && isFdmQuoteConfigured(this.line)) || resinConfigured;

    if (configured) {
      syncFdmQuotePricing(
        this.line,
        this.generalSettings,
        this.costCalculator,
        impresion3DMargin(this.profitMargins),
        {
          ...options,
          preservePrice: options?.preservePrice || !!this.line.unitPriceManual,
          preserveCost: options?.preserveCost,
          productType: isResin
            ? ProductType.RESINA
            : product?.type === ProductType.FDM ||
                product?.type === ProductType.COMBO
              ? product.type
              : ProductType.FDM,
          brand:
            isResin && product && 'brand' in product
              ? product.brand
              : undefined,
          resinType: isResin ? resinType : undefined,
          washMinutes: isResin
            ? resolveOrderQuoteWashMinutes(this.line, product)
            : undefined,
          cureMinutes: isResin
            ? resolveOrderQuoteCureMinutes(this.line, product)
            : undefined,
        },
      );
      return;
    }

    const keepCost =
      options?.preserveCost &&
      this.line.unitCost != null &&
      Number.isFinite(Number(this.line.unitCost));
    const keepPrice = options?.preservePrice || !!this.line.unitPriceManual;
    if (!keepCost) {
      if (product && Number(product.cost) > 0) {
        this.line.unitCost = product.cost;
      } else if (!keepPrice) {
        this.line.unitCost = 0;
      }
    }
    if (!keepPrice) {
      if (product && Number(product.price) > 0) {
        this.line.unitPrice = product.price;
      } else {
        this.line.unitPrice = 0;
      }
    }
  }

  private syncEstampadoLine(options?: {
    preservePrice?: boolean;
    preserveCost?: boolean;
  }): void {
    if (!this.generalSettings || !this.profitMargins) return;

    if (isEstampadoQuoteConfigured(this.line)) {
      syncEstampadoQuotePricing(
        this.line,
        this.generalSettings,
        this.costCalculator,
        estampadoMargin(this.profitMargins),
        {
          ...options,
          preservePrice: options?.preservePrice || !!this.line.unitPriceManual,
          preserveCost: options?.preserveCost,
          supplies: this.supplies,
          impresos: this.impresos,
        },
      );
      return;
    }

    const keepCost =
      options?.preserveCost &&
      this.line.unitCost != null &&
      Number.isFinite(Number(this.line.unitCost));
    const keepPrice = options?.preservePrice || !!this.line.unitPriceManual;
    if (!keepCost) {
      const product = this.product ?? undefined;
      if (product && Number(product.cost) > 0) {
        this.line.unitCost = product.cost;
      } else if (!keepPrice) {
        this.line.unitCost = 0;
      }
    }
    if (!keepPrice) {
      const product = this.product ?? undefined;
      if (product && Number(product.price) > 0) {
        this.line.unitPrice = product.price;
      } else {
        this.line.unitPrice = 0;
      }
    }
  }

  private syncDesignPrintLine(): void {
    if (!this.generalSettings || !this.line.includesPrint) {
      if (!this.line.includesPrint) {
        this.line.unitPrice = this.line.designUnitPrice ?? this.line.unitPrice;
      }
      return;
    }
    syncDesignPrintPricing(this.line, this.generalSettings);
  }

  private money(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(
      Number(value) || 0,
    );
  }

  private emitChanged(): void {
    this.changed.emit();
    this.cdr.markForCheck();
  }
}
