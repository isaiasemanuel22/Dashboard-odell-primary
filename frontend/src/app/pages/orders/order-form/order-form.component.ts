import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CreateOrderPayload,
  CostBreakdown,
  CreateQuotePayload,
  Customer,
  FdmFilamentLine,
  FilamentType,
  MachineProfile,
  MachineProfileRole,
  ProductType,
  Supply,
  SupplyCategory,
  GeneralSettings,
  ImpresoWithCost,
  Order,
  OrderLineDraft,
  PaperType,
  Product,
  Quote,
  QuoteStatus,
  ServiceProfitMargins,
  ServiceType,
} from '../../../core/models';
import { SettingsService, SuppliesService } from '../../../core/services/settings.service';
import { ImpresosService } from '../../../core/services/impresos.service';
import { ProductCostCalculationService } from '../../../core/services/product-cost-calculation.service';
import {
  DbFormComponent,
  DbFormErrorComponent,
  DbFormFooterComponent,
  DbFormGridComponent,
  DbFormGridFullComponent,
  DbInputComponent,
  DbSelectComponent,
  DbTextareaComponent,
  DbRichTextEditorComponent,
  DbButtonComponent,
  DbCheckboxComponent,
  DbIconTrashComponent,
} from '@general-components';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import {
  buildOrderItems,
  calculateLinePriceTotal,
  calculateOrderDiscount,
  calculateOrderSubtotal,
  deriveOrderServices,
  isLineBillable,
  calculateOrderTotal,
  createEmptyLine,
  DUE_DATE_AFTER_TODAY_MESSAGE,
  defaultDueDate,
  isDesignService,
  isDueDateAfterToday,
  minimumDueDate,
  isGraphicDesignService,
  isLineValid,
  lineFromOrderItem,
  orderLinesFromSaleCart,
  orderLineStockHint,
  ORDER_DESCRIPTION_MAX_LENGTH,
  productMatchesServiceType,
  serviceTypeOptions,
  toDateInputValue,
  toOrderDueDate,
} from '../../../shared/utils/order.helpers';
import {
  productComponentSelectLabel,
  calculateOrderLinesCost,
  resolveProductUnitCost,
} from '../../../shared/utils/product.helpers';
import {
  normalizeProfitMargins,
  costFromPriceAndMargin,
  priceFromCostAndMargin,
  getMarginForService,
} from '../../../shared/utils/pricing.util';
import {
  FILAMENT_TYPE_LABELS,
  PAPER_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
} from '../../../shared/constants/labels';
import { DEPOSIT_FACTOR } from '../../../shared/utils/quote-document.util';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
  printQuantity,
  resolvePrintDimensions,
  totalEstampadoPressMinutes,
} from '../../../shared/utils/estampado.helpers';
import {
  calculateMachineOverhead,
  getMachineProfilesForProductType,
} from '../../../shared/utils/machine-profile.util';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';
import { plainTextFromHtml, hasRichTextContent, sanitizeRichTextHtml } from '../../../shared/utils/rich-text.util';
import { MediaUploadService } from '../../../core/services/media-upload.service';
import { DbFileUploadFn } from '../../../components/dashboard-form/db-file-upload/db-file-upload.types';
import { firstValueFrom } from 'rxjs';
import {
  DiscountMode,
  discountModeFromValues,
  discountPayloadFromMode,
} from '../../../shared/utils/discount.util';
import { DbSelectOption } from '../../../components/dashboard-form/db-select/db-select.types';
import {
  applyImpresoToDesignLine,
  syncDesignPrintPricing,
} from '../../../shared/utils/design-print.util';
import { filamentTypeOptions, paperTypeOptions } from '../../../shared/utils/select-options';
import {
  applyProductSpecsToFdmLine,
  impresion3DMargin,
  isFdmQuoteConfigured,
  isImpresion3DLine,
  shouldShowFdmQuoteFields,
  syncFdmQuotePricing,
} from '../../../shared/utils/order-fdm-quote.util';
import {
  applyProductSpecsToEstampadoLine,
  estampadoMargin,
  isEstampadoLine,
  isEstampadoQuoteConfigured,
  shouldShowEstampadoQuoteFields,
  syncEstampadoQuotePricing,
} from '../../../shared/utils/order-estampado-quote.util';
import {
  FilamentLineListComponent,
  PrintSpecListComponent,
  PressCycleListComponent,
  SupplyLineListComponent,
} from '../../products/product-form/dynamic-lists/public-api';
import {
  createEmptyFdmFilamentLine,
  normalizeFdmFilaments,
  totalFdmFilamentGrams,
} from '../../../shared/utils/fdm.helpers';
import { lineFromQuoteItem } from '../../../shared/utils/quote.helpers';

export type OrderFormVariant = 'order' | 'quote';

const AREA_SHORT_LABELS: Record<ServiceType, string> = {
  [ServiceType.IMPRESION_3D]: '3D',
  [ServiceType.DISENO_GRAFICO]: 'Diseño',
  [ServiceType.MODELADO]: 'Modelado',
  [ServiceType.ESTAMPADO]: 'Estampado',
};

export type OrderFormSavePayload = CreateOrderPayload | CreateQuotePayload;

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    RouterLink,
    DbFormComponent,
    DbFormGridComponent,
    DbFormGridFullComponent,
    DbSelectComponent,
    DbInputComponent,
    DbTextareaComponent,
    DbRichTextEditorComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
    DbCheckboxComponent,
    DbIconTrashComponent,
    CurrencyArsPipe,
    FilamentLineListComponent,
    PrintSpecListComponent,
    PressCycleListComponent,
    SupplyLineListComponent,
  ],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.scss',
})
export class OrderFormComponent implements OnChanges, OnInit {
  private readonly formDialogs = inject(FormDialogService);
  private readonly mediaUpload = inject(MediaUploadService);
  private readonly settingsService = inject(SettingsService);
  private readonly impresosService = inject(ImpresosService);
  private readonly costCalculator = inject(ProductCostCalculationService);
  private readonly suppliesService = inject(SuppliesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly collapsedLines = new WeakSet<OrderLineDraft>();

  readonly PaperType = PaperType;
  readonly paperTypeOptions = paperTypeOptions();
  readonly filamentTypeOptions = filamentTypeOptions();

  readonly uploadDescriptionImage: DbFileUploadFn = (file) =>
    firstValueFrom(this.mediaUpload.uploadProductImage(file));

  @Input() order: Order | null = null;
  @Input() quote: Quote | null = null;
  @Input() variant: OrderFormVariant = 'order';
  @Input() customers: Customer[] = [];
  @Input() products: Product[] = [];
  @Input() presetCustomerId = '';
  @Input() presetCartLines: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }> = [];
  /** Precarga líneas y descuento al crear un pedido desde un presupuesto. */
  @Input() presetQuote: Quote | null = null;
  @Input() loading = false;
  @Input() error = '';
  @Output() save = new EventEmitter<OrderFormSavePayload>();
  @Output() cancel = new EventEmitter<void>();
  @Output() customerCreated = new EventEmitter<Customer>();

  customerId = '';
  dueDate = defaultDueDate();
  description = '';
  notes = '';
  lines: OrderLineDraft[] = [createEmptyLine(ServiceType.IMPRESION_3D)];
  discountMode: DiscountMode = 'none';
  discountPercent = 0;
  discountAmount = 0;
  /** null hasta que carguen Ajustes reales; no usar defaults inventados en hints. */
  profitMargins: ServiceProfitMargins | null = null;
  generalSettings: GeneralSettings | null = null;
  impresos: ImpresoWithCost[] = [];
  supplies: Supply[] = [];
  readonly depositPercent = Math.round(DEPOSIT_FACTOR * 100);

  readonly serviceTypeOptions = serviceTypeOptions();
  readonly discountModeOptions: DbSelectOption[] = [
    { value: 'none', label: 'Sin descuento' },
    { value: 'percent', label: 'Porcentaje (%)' },
    { value: 'amount', label: 'Monto fijo ($)' },
  ];
  readonly descriptionMaxLength = ORDER_DESCRIPTION_MAX_LENGTH;
  readonly ServiceType = ServiceType;
  readonly isDesignService = isDesignService;
  readonly isGraphicDesignService = isGraphicDesignService;
  readonly isImpresion3DLine = isImpresion3DLine;
  readonly shouldShowFdmQuoteFields = shouldShowFdmQuoteFields;
  readonly isEstampadoLine = isEstampadoLine;
  readonly shouldShowEstampadoQuoteFields = shouldShowEstampadoQuoteFields;

  get isQuoteForm(): boolean {
    return this.variant === 'quote';
  }

  get quotedAtLabel(): string {
    const source = this.quote?.quotedAt ?? new Date().toISOString();
    return new Date(source).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  get quoteValidityLabel(): string {
    const base = new Date(this.quote?.quotedAt ?? Date.now());
    const validUntil = new Date(base);
    validUntil.setDate(validUntil.getDate() + 15);
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `Válido hasta el ${validUntil.getDate()} de ${months[validUntil.getMonth()]} de ${validUntil.getFullYear()}`;
  }

  get linesHint(): string {
    if (this.isQuoteForm) {
      const count = this.lines.length;
      const noun = count === 1 ? 'línea' : 'líneas';
      return `${count} ${noun} · una por servicio`;
    }
    return this.orderLinesCountLabel;
  }

  get submitLabel(): string {
    if (this.loading) return 'Guardando...';
    if (this.isEditing) return 'Guardar cambios';
    if (this.presetQuote) return 'Generar pedido';
    return this.isQuoteForm ? 'Crear presupuesto' : 'Crear pedido';
  }

  get isEditing(): boolean {
    if (this.isQuoteForm) return this.quote !== null;
    return this.order !== null;
  }

  get customerOptions() {
    return this.customers.map((c) => ({
      value: c.id,
      label:
        c.company && c.company.trim() !== c.name.trim()
          ? `${c.name} - ${c.company}`
          : c.name,
    }));
  }

  get dueDateBusinessDaysHint(): string {
    if (!this.dueDate) return '';
    const days = this.countBusinessDaysInclusive(this.dueDate);
    if (days <= 0) return '';
    const noun = days === 1 ? 'día hábil' : 'días hábiles';
    return `${days} ${noun} desde hoy`;
  }

  get orderLinesCountLabel(): string {
    const count = this.lines.length;
    const noun = count === 1 ? 'línea' : 'líneas';
    const taskNoun = count === 1 ? 'tarea' : 'tareas';
    return `${count} ${noun} - se van a crear ${count} ${taskNoun} en la cola`;
  }

  get subtotalLinesLabel(): string {
    const count = this.billableLines.length || this.lines.length;
    const noun = count === 1 ? 'línea' : 'líneas';
    return `Subtotal - ${count} ${noun}`;
  }

  get quoteSubtotalLabel(): string {
    const count = this.billableLines.length;
    if (count <= 1) return 'Subtotal';
    return `Subtotal · ${count} líneas`;
  }

  get validLines(): OrderLineDraft[] {
    return this.lines.filter((line) => isLineValid(line));
  }

  get billableLines(): OrderLineDraft[] {
    return this.lines.filter((line) => isLineBillable(line));
  }

  get subtotal(): number {
    return calculateOrderSubtotal(this.billableLines);
  }

  get discountApplied(): number {
    const discount = discountPayloadFromMode(
      this.discountMode,
      this.discountPercent,
      this.discountAmount,
    );
    return calculateOrderDiscount(
      this.billableLines,
      discount.discountPercent,
      discount.discountAmount,
    );
  }

  get total(): number {
    const discount = discountPayloadFromMode(
      this.discountMode,
      this.discountPercent,
      this.discountAmount,
    );
    return calculateOrderTotal(
      this.billableLines,
      discount.discountPercent,
      discount.discountAmount,
    );
  }

  get hasDiscount(): boolean {
    return this.discountMode !== 'none';
  }

  get showProfitPreview(): boolean {
    return this.billableLines.length > 0;
  }

  get settingsReady(): boolean {
    return this.generalSettings != null && this.profitMargins != null;
  }

  get totalCost(): number {
    if (!this.profitMargins) return 0;
    return calculateOrderLinesCost(
      this.billableLines,
      this.products,
      this.profitMargins,
    );
  }

  get profit(): number {
    return this.total - this.totalCost;
  }

  get depositAmount(): number {
    return Math.round(this.total * DEPOSIT_FACTOR);
  }

  get quoteResumenItems(): Array<{
    key: string;
    serviceType: ServiceType;
    label: string;
    total: number;
  }> {
    return this.billableLines.map((line, index) => {
      const qty = Math.max(1, Number(line.quantity) || 1);
      return {
        key: `${index}-${line.serviceType}-${line.productId || 'custom'}`,
        serviceType: line.serviceType,
        label: `${this.lineTitle(line, index)} · ${qty} u`,
        total: this.linePriceTotal(line),
      };
    });
  }

  get quoteAreaShares(): Array<{ serviceType: ServiceType; label: string; percent: number }> {
    const subtotal = this.subtotal;
    if (subtotal <= 0) return [];
    const totals = new Map<ServiceType, number>();
    for (const line of this.billableLines) {
      totals.set(
        line.serviceType,
        (totals.get(line.serviceType) ?? 0) + this.linePriceTotal(line),
      );
    }
    return [...totals.entries()]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([serviceType, value]) => ({
        serviceType,
        label: AREA_SHORT_LABELS[serviceType],
        percent: Math.round((value / subtotal) * 100),
      }));
  }

  get quoteResumenWarnings(): string[] {
    const warnings: string[] = [];
    const missingRates = [
      ...new Set(
        this.lines
          .filter((line) => this.designRateMissingHint(line))
          .map((line) => this.serviceLabel(line.serviceType)),
      ),
    ];
    if (missingRates.length > 1) {
      warnings.push(
        'Diseño y modelado salen en costo porque sus tarifas por hora están en $ 0. La seña y el área siguen contando.',
      );
    } else if (missingRates.length === 1) {
      const label = missingRates[0] === SERVICE_TYPE_LABELS[ServiceType.DISENO_GRAFICO]
        ? 'Diseño'
        : missingRates[0] === SERVICE_TYPE_LABELS[ServiceType.MODELADO]
          ? 'Modelado'
          : missingRates[0];
      warnings.push(
        `${label} sale en costo porque la tarifa por hora está en $ 0. La seña y el área siguen contando.`,
      );
    }
    for (const name of this.suppliesWithoutPrice()) {
      warnings.push(`${name} no tiene precio en Insumos: el costo no lo incluye.`);
    }
    return warnings;
  }

  isLineCollapsed(line: OrderLineDraft): boolean {
    return this.collapsedLines.has(line);
  }

  toggleLineCollapsed(line: OrderLineDraft): void {
    if (this.collapsedLines.has(line)) {
      this.collapsedLines.delete(line);
    } else {
      this.collapsedLines.add(line);
    }
  }

  lineTitle(line: OrderLineDraft, index: number): string {
    return (
      line.customName?.trim() ||
      this.productForLine(line)?.name ||
      `Línea ${index + 1}`
    );
  }

  lineCollapsedDetail(line: OrderLineDraft): string {
    const qty = Math.max(1, Number(line.quantity) || 1);
    const parts = [`${qty} × ${this.money(this.unitPriceForLine(line))}`];
    if (isImpresion3DLine(line.serviceType)) {
      const breakdown = this.fdmBreakdown(line);
      if (breakdown) {
        parts.push(`Filamento ${this.money(breakdown.materialCost)}`);
        parts.push(
          `Impresión ${this.money(breakdown.energyCost + breakdown.machineCost)}`,
        );
      }
    } else if (isEstampadoLine(line.serviceType)) {
      const costs = this.estampadoCosts(line);
      parts.push(`Impresos ${this.money(costs.prints)}`);
      parts.push(`Insumos ${this.money(costs.supplies)}`);
      parts.push(`Plancha ${this.money(costs.press)}`);
    }
    return parts.join(' · ');
  }

  unitPriceForLine(line: OrderLineDraft): number {
    return isDesignService(line.serviceType)
      ? this.designUnitPriceForLine(line)
      : Number(line.unitPrice) || 0;
  }

  get errorMarginPercent(): number {
    return Math.min(
      Math.max(Number(this.generalSettings?.errorMarginPercent) || 0, 0),
      100,
    );
  }

  fdmBreakdown(line: OrderLineDraft): CostBreakdown | null {
    if (!this.generalSettings || !isFdmQuoteConfigured(line)) return null;
    return this.costCalculator.calculateCost(
      {
        type: ProductType.FDM,
        grams: Number(line.grams) || 0,
        printTimeHours: Number(line.printTimeHours) || 0,
        workTimeHours: Number(line.workTimeHours) || 0,
        filamentType: line.filamentType as FilamentType,
        filaments: line.filaments,
      },
      { settings: this.generalSettings },
    );
  }

  fdmFilamentSummary(line: OrderLineDraft): string {
    const rows = line.filaments ?? [];
    const active = rows.filter((row) => Number(row.grams) > 0);
    const counted = active.length ? active : rows;
    const count = counted.length || 1;
    const grams = rows.length
      ? totalFdmFilamentGrams(rows)
      : Number(line.grams) || 0;
    const types = [
      ...new Set(counted.map((row) => row.filamentType).filter(Boolean)),
    ];
    const typeLabel = types.length
      ? types.map((type) => FILAMENT_TYPE_LABELS[type]).join(' · ')
      : line.filamentType
        ? FILAMENT_TYPE_LABELS[line.filamentType]
        : 'Sin material';
    const noun = count === 1 ? 'filamento' : 'filamentos';
    return `${count} ${noun} · ${this.formatNumber(grams)} g · ${typeLabel}`;
  }

  quoteFilaments(line: OrderLineDraft): FdmFilamentLine[] {
    if (!line.filaments?.length) {
      const restored = normalizeFdmFilaments(undefined, {
        grams: line.grams,
        filamentType: line.filamentType,
      });
      line.filaments = restored.length
        ? restored
        : [createEmptyFdmFilamentLine(line.filamentType ?? FilamentType.PLA)];
    }
    return line.filaments;
  }

  onFilamentsChange(line: OrderLineDraft, filaments: FdmFilamentLine[]): void {
    line.filaments = filaments;
    line.grams = totalFdmFilamentGrams(filaments);
    line.filamentType = filaments.find((item) => item.filamentType)?.filamentType;
    this.onFdmQuoteChange(line);
  }

  onWorkHoursChange(line: OrderLineDraft, raw: number | string): void {
    line.workTimeHours = Math.max(0, Number(raw) || 0);
    this.onFdmQuoteChange(line);
  }

  laborSummary(line: OrderLineDraft): string {
    const hours = Number(line.workTimeHours) || 0;
    const rate = Number(this.generalSettings?.laborCostPerHour) || 0;
    const base = `${this.formatNumber(hours)} h × ${this.money(rate)}/h`;
    const note = line.laborNote?.trim();
    return note ? `${base} · ${note}` : base;
  }

  laborCost(line: OrderLineDraft): number {
    const breakdown = this.fdmBreakdown(line);
    if (breakdown) return breakdown.laborCost;
    const hours = Number(line.workTimeHours) || 0;
    const rate = Number(this.generalSettings?.laborCostPerHour) || 0;
    return Math.round(hours * rate);
  }

  chargeModeFor(line: OrderLineDraft): 'hours' | 'fixed' {
    if (line.chargeMode) return line.chargeMode;
    return isGraphicDesignService(line.serviceType) ? 'fixed' : 'hours';
  }

  setChargeMode(line: OrderLineDraft, mode: 'hours' | 'fixed'): void {
    if (this.chargeModeFor(line) === mode) return;

    const losesFixedPrice =
      mode === 'hours' &&
      this.chargeModeFor(line) === 'fixed' &&
      ((Number(line.unitPrice) || 0) > 0 ||
        (Number(line.designUnitPrice) || 0) > 0);

    if (!losesFixedPrice) {
      this.applyChargeMode(line, mode);
      return;
    }

    this.formDialogs
      .openConfirm({
        title: 'Cambiar modo de cobro',
        message:
          'Al pasar a «Por horas» el precio se recalcula desde las horas presupuestadas. Se va a borrar el precio fijo cargado. ¿Continuar?',
        confirmLabel: 'Cambiar a por horas',
        cancelLabel: 'Cancelar',
        confirmVariant: 'primary',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.applyChargeMode(line, mode);
      });
  }

  private applyChargeMode(line: OrderLineDraft, mode: 'hours' | 'fixed'): void {
    line.chargeMode = mode;
    if (mode === 'hours') this.applyDesignBudget(line);
  }

  workKindOptions(line: OrderLineDraft): DbSelectOption[] {
    const kinds = isGraphicDesignService(line.serviceType)
      ? ['Rediseño de logo', 'Diseño de logo', 'Adaptación de archivo', 'Otro']
      : ['Pieza de repuesto', 'Modelado de producto', 'Ajuste de modelo', 'Otro'];
    return [
      { value: '', label: 'Elegí el tipo' },
      ...kinds.map((kind) => ({ value: kind, label: kind })),
    ];
  }

  onWorkKindChange(line: OrderLineDraft, value: string): void {
    line.workKind = value;
  }

  deliverableOptions(line: OrderLineDraft): string[] {
    return isGraphicDesignService(line.serviceType)
      ? ['PNG', 'SVG', 'PDF', 'AI']
      : ['STL', '3MF', 'OBJ', 'STEP'];
  }

  hasDeliverable(line: OrderLineDraft, item: string): boolean {
    return (line.deliverables ?? []).includes(item);
  }

  toggleDeliverable(line: OrderLineDraft, item: string): void {
    const current = line.deliverables ?? [];
    line.deliverables = current.includes(item)
      ? current.filter((entry) => entry !== item)
      : [...current, item];
  }

  designWorkSummary(line: OrderLineDraft): string {
    const parts: string[] = [];
    if (this.chargeModeFor(line) === 'fixed') {
      parts.push('Precio fijo');
    } else {
      parts.push(`${this.formatNumber(Number(line.budgetedHours) || 0)} h`);
    }
    if (line.workKind?.trim()) parts.push(line.workKind.trim());
    if (line.deliverables?.length) parts.push(line.deliverables.join(' + '));
    if (line.needsClientProduct) parts.push('requiere el producto');
    return parts.join(' · ');
  }

  fdmPrintSummary(line: OrderLineDraft): string {
    const hours = Number(line.printTimeHours) || 0;
    const breakdown = this.fdmBreakdown(line);
    const profile = this.machineProfile(ProductType.FDM, MachineProfileRole.PRINT);
    const parts = [
      profile?.name ?? 'Impresora',
      `${this.formatNumber(hours)} h`,
    ];
    if (breakdown) {
      parts.push(
        `luz ${this.money(breakdown.energyCost)} + máquina ${this.money(breakdown.machineCost)}`,
      );
    }
    return parts.join(' · ');
  }

  estampadoCosts(line: OrderLineDraft): {
    prints: number;
    supplies: number;
    press: number;
    errorMargin: number;
    pressMinutes: number;
    energy: number;
    machine: number;
  } {
    const settings = this.generalSettings;
    const pressMinutes = totalEstampadoPressMinutes(line.estampadoPressCycles);
    if (!settings) {
      return { prints: 0, supplies: 0, press: 0, errorMargin: 0, pressMinutes, energy: 0, machine: 0 };
    }
    const prints = normalizeEstampadoPrints(line.estampadoPrints).reduce(
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
    const supplies = normalizeEstampadoSupplies(line.estampadoSupplies).reduce(
      (sum, entry) => {
        const supply = this.supplies.find((item) => item.id === entry.supplyId);
        return supply
          ? sum + (Number(supply.unitPrice) || 0) * (Number(entry.quantity) || 0)
          : sum;
      },
      0,
    );
    const overhead = calculateMachineOverhead(settings, ProductType.ESTAMPADO, {
      printTimeHours: 0,
      pressMinutes,
    });
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
      errorMargin,
      pressMinutes,
      energy: overhead.energyCost,
      machine: overhead.machineCost,
    };
  }

  estampadoPrintsSummary(line: OrderLineDraft): string {
    const prints = normalizeEstampadoPrints(line.estampadoPrints).filter(
      (print) =>
        !!resolvePrintDimensions(print, (id) =>
          this.impresos.find((item) => item.id === id),
        ),
    );
    if (!prints.length) return 'Sin impresos';
    const count = prints.reduce((sum, print) => sum + printQuantity(print), 0);
    const papers = [
      ...new Set(
        prints
          .map((print) => print.paperType)
          .filter(Boolean)
          .map((type) => PAPER_TYPE_LABELS[type] ?? type),
      ),
    ];
    const noun = count === 1 ? 'impreso' : 'impresos';
    return [`${count} ${noun}`, ...papers].join(' · ');
  }

  estampadoSuppliesSummary(line: OrderLineDraft): { text: string; missingPrice: boolean } {
    const entries = normalizeEstampadoSupplies(line.estampadoSupplies);
    if (!entries.length) return { text: 'Sin insumos', missingPrice: false };
    let missingPrice = false;
    const text = entries
      .map((entry) => {
        const supply = this.supplies.find((item) => item.id === entry.supplyId);
        if (!supply || !(Number(supply.unitPrice) > 0)) missingPrice = true;
        return `${supply?.name ?? 'Insumo'} × ${this.formatNumber(entry.quantity)}`;
      })
      .join(' · ');
    return { text, missingPrice };
  }

  estampadoPressSummary(line: OrderLineDraft): string {
    const cycles = normalizeEstampadoPressCycles(line.estampadoPressCycles);
    const bajadas = cycles.reduce((sum, cycle) => sum + (Number(cycle.bajadas) || 1), 0);
    const minutes = totalEstampadoPressMinutes(line.estampadoPressCycles);
    const profile = this.pressProfile;
    const parts = profile ? [profile.name] : [];
    parts.push(`${bajadas} ${bajadas === 1 ? 'bajada' : 'bajadas'}`);
    parts.push(`${this.formatNumber(minutes)} min`);
    return parts.join(' · ');
  }

  get pressProfile(): MachineProfile | undefined {
    return this.machineProfile(ProductType.ESTAMPADO, MachineProfileRole.PRESS);
  }

  get pressProfileOptions(): DbSelectOption[] {
    const profile = this.pressProfile;
    return profile
      ? [{ value: profile.id, label: `${profile.name} · ${profile.watts} W` }]
      : [{ value: '', label: 'Sin plancha en Ajustes' }];
  }

  get electricityCostPerKwh(): number {
    return Number(this.generalSettings?.electricityCostPerKwh) || 0;
  }

  formatGrams(line: OrderLineDraft): string {
    return this.formatNumber(Number(line.grams) || 0);
  }

  suggestedUnitPriceHint(line: OrderLineDraft): string {
    if (!this.profitMargins) return '';
    const cost = this.lineUnitCost(line);
    const price = Number(line.unitPrice) || 0;
    if (cost > 0 && price > 0) {
      const percent = Math.round(((price - cost) / cost) * 100);
      return `Margen · ${percent}% sobre el costo del formulario`;
    }
    const margin = isEstampadoLine(line.serviceType)
      ? estampadoMargin(this.profitMargins)
      : impresion3DMargin(this.profitMargins);
    const suggested = priceFromCostAndMargin(cost, margin);
    return `Sugerido ${this.money(suggested)} (costo + ${margin}%)`;
  }

  designCostHint(line: OrderLineDraft): string {
    const hours = Number(line.budgetedHours) || 0;
    const rateLabel = isGraphicDesignService(line.serviceType)
      ? 'tarifa de diseño'
      : 'tarifa de modelado';
    return `${this.formatNumber(hours)} h × ${rateLabel}`;
  }

  designPriceHint(line: OrderLineDraft): string {
    if (!this.profitMargins) return '';
    if (this.serviceRate(line) <= 0) {
      const rateLabel = isGraphicDesignService(line.serviceType)
        ? 'Tarifa de diseño'
        : 'Tarifa de modelado';
      return `${rateLabel} en $ 0: el sugerido no se calcula`;
    }
    return `Margen ${this.serviceLabel(line.serviceType)} (${this.designMarginFor(line)}%)`;
  }

  private machineProfile(
    productType: ProductType,
    role: MachineProfileRole,
  ): MachineProfile | undefined {
    if (!this.generalSettings) return undefined;
    return getMachineProfilesForProductType(this.generalSettings, productType).find(
      (profile) => profile.role === role,
    );
  }

  private suppliesWithoutPrice(): string[] {
    const names = new Set<string>();
    for (const line of this.lines) {
      if (!isEstampadoLine(line.serviceType)) continue;
      for (const entry of normalizeEstampadoSupplies(line.estampadoSupplies)) {
        const supply = this.supplies.find((item) => item.id === entry.supplyId);
        if (supply && !(Number(supply.unitPrice) > 0)) names.add(supply.name);
      }
    }
    return [...names];
  }

  plainAmount(value: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(
      Number(value) || 0,
    );
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

  designMarginFor(line: OrderLineDraft): number {
    if (!this.profitMargins) return 0;
    return getMarginForService(line.serviceType, this.profitMargins);
  }

  ngOnInit(): void {
    const cached = this.settingsService.peekGeneralSettings();
    if (cached) {
      this.applyGeneralSettings(cached);
    }
    this.settingsService.getGeneralSettings().subscribe((settings) => {
      this.applyGeneralSettings(settings);
      this.syncDesignLineCosts();
      this.syncAllDesignPrintLines();
      this.syncAllFdmLines({ preservePrice: this.isEditing });
      this.syncAllEstampadoLines({ preservePrice: this.isEditing });
    });
    this.impresosService.getImpresos().subscribe((items) => {
      this.impresos = items;
    });
    if (this.isQuoteForm) {
      this.suppliesService
        .watchSupplies(SupplyCategory.ESTAMPADO)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((items) => {
          this.supplies = items;
        });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['order'] ||
      changes['quote'] ||
      changes['products'] ||
      changes['presetCustomerId'] ||
      changes['presetCartLines'] ||
      changes['presetQuote']
    ) {
      this.resetForm();
    }
  }

  serviceLabel(serviceType: ServiceType): string {
    return SERVICE_TYPE_LABELS[serviceType];
  }

  lineServiceOptions() {
    return this.serviceTypeOptions;
  }

  productOptionsForLine(line: OrderLineDraft) {
    const options = this.products
      .filter((p) => productMatchesServiceType(p, line.serviceType))
      .map((p) => ({
        value: p.id,
        label: productComponentSelectLabel(p),
      }));

    if (isImpresion3DLine(line.serviceType) || isEstampadoLine(line.serviceType)) {
      options.unshift({
        value: '',
        label: 'Presupuesto manual (sin catálogo)',
      });
    }

    if (
      line.productId &&
      !options.some((o) => o.value === line.productId)
    ) {
      const current = this.products.find((p) => p.id === line.productId);
      if (current) {
        options.unshift({
          value: current.id,
          label: productComponentSelectLabel(current),
        });
      }
    }

    return options;
  }

  onLineServiceChange(line: OrderLineDraft): void {
    line.productId = isDesignService(line.serviceType) ? undefined : '';
    line.customName = isDesignService(line.serviceType) ? '' : undefined;
    line.conceptManual = undefined;
    line.unitCost = isDesignService(line.serviceType) ? 0 : undefined;
    line.unitPrice = 0;
    line.budgetedHours = isDesignService(line.serviceType) ? 0 : undefined;
    line.printTimeHours = undefined;
    line.grams = undefined;
    line.filamentType = undefined;
    line.estampadoPrints = isEstampadoLine(line.serviceType) ? [] : undefined;
    line.estampadoPressCycles = isEstampadoLine(line.serviceType) ? [] : undefined;
    line.estampadoSupplies = isEstampadoLine(line.serviceType) ? [] : undefined;
    if (!isGraphicDesignService(line.serviceType)) {
      line.includesPrint = false;
      line.printPaperType = undefined;
      line.printWidthCm = undefined;
      line.printLengthCm = undefined;
      line.printImpresoId = undefined;
      line.printUnitCost = undefined;
      line.printUnitPrice = undefined;
    }
    line.designUnitPrice = undefined;
    line.filaments = undefined;
    line.workTimeHours = undefined;
    line.laborNote = undefined;
    line.workKind = undefined;
    line.deliverables = undefined;
    line.includesRevisions = undefined;
    line.needsClientProduct = undefined;
    line.linkPrint = undefined;
    if (isDesignService(line.serviceType)) {
      line.chargeMode = isGraphicDesignService(line.serviceType) ? 'fixed' : 'hours';
      this.applyDesignBudget(line);
    } else {
      line.chargeMode = undefined;
    }
  }

  /** B7: actualizar Concepto y marcarlo como editado a mano. */
  onConceptChange(line: OrderLineDraft, value: string): void {
    line.customName = value;
    line.conceptManual = true;
  }

  /**
   * B7: al cambiar producto, actualizar Concepto al nombre nuevo
   * salvo que el usuario lo haya editado a mano (`conceptManual`).
   */
  onProductChange(line: OrderLineDraft, productId: string): void {
    line.productId = productId ?? '';

    const product = line.productId
      ? this.products.find((p) => p.id === line.productId)
      : undefined;

    if (product && !line.conceptManual) {
      line.customName = product.name;
    }

    if (!product) {
      line.unitPrice = 0;
      line.unitCost = undefined;
      if (isEstampadoLine(line.serviceType)) {
        line.estampadoPrints ??= [];
        line.estampadoPressCycles ??= [];
        line.estampadoSupplies ??= [];
        this.syncEstampadoLine(line, { preservePrice: false });
      }
      if (isImpresion3DLine(line.serviceType)) {
        // Catálogo → manual: conservar filamentos y normalizar color
        // para que el selector no quede en blanco.
        if (line.filaments?.length) {
          line.filaments = normalizeFdmFilaments(line.filaments);
        } else {
          this.quoteFilaments(line);
        }
        this.syncFdmLine(line, { preservePrice: false });
      }
      return;
    }

    applyProductSpecsToFdmLine(line, product);
    applyProductSpecsToEstampadoLine(line, product);
    if (isImpresion3DLine(line.serviceType)) {
      this.syncFdmLine(line, { preservePrice: false });
      return;
    }
    if (isEstampadoLine(line.serviceType)) {
      this.syncEstampadoLine(line, { preservePrice: false });
      return;
    }

    line.unitPrice = product.price;
  }

  onFdmQuoteChange(line: OrderLineDraft): void {
    this.syncFdmLine(line);
  }

  onEstampadoQuoteChange(line: OrderLineDraft): void {
    this.syncEstampadoLine(line);
  }

  productForLine(line: OrderLineDraft): Product | undefined {
    return line.productId
      ? this.products.find((p) => p.id === line.productId)
      : undefined;
  }

  lineUnitCost(line: OrderLineDraft): number {
    if (line.unitCost != null && line.unitCost >= 0) {
      return line.unitCost;
    }
    return this.productUnitCost(line);
  }

  fdmPricingHint(line: OrderLineDraft): string {
    if (this.isCatalogLocked(line)) {
      return 'Costo calculado con los datos del producto (solo lectura).';
    }
    return 'Presupuesto calculado según configuración de costos y margen de Impresión 3D.';
  }

  estampadoPricingHint(line: OrderLineDraft): string {
    if (this.isCatalogLocked(line)) {
      return 'Costo calculado con los datos del producto (solo lectura).';
    }
    return 'Presupuesto calculado con insumos, impresos y bajadas + margen de Estampado.';
  }

  unitPriceHint(line: OrderLineDraft): string {
    if (line.productId) {
      return 'Precio del catálogo de productos.';
    }
    if (!this.profitMargins) return '';
    if (isEstampadoLine(line.serviceType)) {
      const margin = estampadoMargin(this.profitMargins);
      return `Sugerido: costo + ${margin}% de margen`;
    }
    const margin = impresion3DMargin(this.profitMargins);
    return `Sugerido: costo + ${margin}% de margen`;
  }

  setLineService(line: OrderLineDraft, serviceType: ServiceType): void {
    if (line.serviceType === serviceType) return;

    if (!this.lineHasResettableData(line)) {
      this.applyLineService(line, serviceType);
      return;
    }

    this.formDialogs
      .openConfirm({
        title: 'Cambiar servicio',
        message: this.serviceChangeConfirmMessage(line, serviceType),
        confirmLabel: 'Cambiar servicio',
        cancelLabel: 'Cancelar',
        confirmVariant: 'primary',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.applyLineService(line, serviceType);
      });
  }

  private applyLineService(line: OrderLineDraft, serviceType: ServiceType): void {
    line.serviceType = serviceType;
    this.onLineServiceChange(line);
  }

  /** True si al resetear la línea se perdería algo que el usuario cargó. */
  private lineHasResettableData(line: OrderLineDraft): boolean {
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

  private serviceChangeConfirmMessage(
    line: OrderLineDraft,
    next: ServiceType,
  ): string {
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

  setDiscountMode(mode: DiscountMode): void {
    this.discountMode = mode;
    if (mode === 'none') {
      this.discountPercent = 0;
      this.discountAmount = 0;
    }
  }

  onGramsChange(line: OrderLineDraft, raw: number | string): void {
    line.grams = Math.max(0, Number(raw) || 0);
    this.onFdmQuoteChange(line);
  }

  onPrintHoursChange(line: OrderLineDraft, raw: number | string): void {
    line.printTimeHours = Math.max(0, Number(raw) || 0);
    this.onFdmQuoteChange(line);
  }

  serviceRate(line: OrderLineDraft): number {
    if (!this.generalSettings) return 0;
    if (isGraphicDesignService(line.serviceType)) {
      return this.generalSettings.graphicDesignRatePerHour ?? 0;
    }
    if (line.serviceType === ServiceType.MODELADO) {
      return this.generalSettings.modelingRatePerHour ?? 0;
    }
    return 0;
  }

  serviceRateLabel(line: OrderLineDraft): string {
    return isGraphicDesignService(line.serviceType)
      ? 'Tarifa diseño gráfico'
      : 'Tarifa modelado';
  }

  designRateMissingHint(line: OrderLineDraft): string | null {
    if (!isDesignService(line.serviceType)) return null;
    if (this.serviceRate(line) > 0) return null;
    return isGraphicDesignService(line.serviceType)
      ? 'Tarifa de diseño sin cargar en Ajustes'
      : 'Tarifa de modelado sin cargar en Ajustes';
  }

  lineAccentClass(serviceType: ServiceType): string {
    return `order-line--accent-${serviceType}`;
  }

  servicePillModifier(serviceType: ServiceType): string {
    return `service-pill--${serviceType}`;
  }

  productFieldLabel(line: OrderLineDraft): string {
    return line.serviceType === ServiceType.ESTAMPADO ? 'Impreso' : 'Producto';
  }

  private countBusinessDaysInclusive(dueDateInput: string): number {
    const due = new Date(`${dueDateInput}T12:00:00`);
    if (Number.isNaN(due.getTime())) return 0;
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    if (due < start) return 0;
    let count = 0;
    const cursor = new Date(start);
    while (cursor <= due) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) count += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  onBudgetedHoursChange(line: OrderLineDraft, raw: number | string): void {
    line.budgetedHours = Math.max(0, Number(raw) || 0);
    this.applyDesignBudget(line);
  }

  onDesignUnitCostChange(line: OrderLineDraft, raw: number | string): void {
    const cost = Number(raw) || 0;
    line.unitCost = cost;
    if (!this.profitMargins) {
      line.designUnitPrice = cost;
      this.syncDesignPrintLine(line);
      return;
    }
    const designPrice = priceFromCostAndMargin(cost, this.designMarginFor(line));
    line.designUnitPrice = designPrice;
    this.syncDesignPrintLine(line);
  }

  onDesignUnitPriceChange(line: OrderLineDraft, raw: number | string): void {
    const price = Number(raw) || 0;
    line.designUnitPrice = price;
    if (!this.profitMargins) {
      line.unitCost = price;
      this.syncDesignPrintLine(line);
      return;
    }
    line.unitCost = costFromPriceAndMargin(price, this.designMarginFor(line));
    this.syncDesignPrintLine(line);
  }

  onIncludesPrintChange(line: OrderLineDraft, checked: boolean): void {
    line.includesPrint = checked;
    if (checked) {
      line.designUnitPrice ??= line.unitPrice;
      line.printPaperType ??= PaperType.DTF;
      line.printImpresoId ??= '';
    } else {
      line.unitPrice = line.designUnitPrice ?? line.unitPrice;
      line.printPaperType = undefined;
      line.printWidthCm = undefined;
      line.printLengthCm = undefined;
      line.printImpresoId = undefined;
      line.printUnitCost = undefined;
      line.printUnitPrice = undefined;
    }
    this.syncDesignPrintLine(line);
  }

  onPrintPaperTypeChange(line: OrderLineDraft): void {
    line.printImpresoId = '';
    this.syncDesignPrintLine(line);
  }

  onPrintImpresoChange(line: OrderLineDraft): void {
    applyImpresoToDesignLine(line, this.impresos);
    this.syncDesignPrintLine(line);
  }

  onPrintDimensionsChange(line: OrderLineDraft): void {
    line.printImpresoId = '';
    this.syncDesignPrintLine(line);
  }

  impresoOptionsForLine(line: OrderLineDraft): DbSelectOption[] {
    const paperType = line.printPaperType;
    return this.impresos
      .filter((item) => !paperType || item.paperType === paperType)
      .map((item) => ({
        value: item.id,
        label: item.name,
      }));
  }

  designUnitPriceForLine(line: OrderLineDraft): number {
    return line.designUnitPrice ?? line.unitPrice;
  }

  linePriceTotal(line: OrderLineDraft): number {
    return calculateLinePriceTotal(line);
  }

  productUnitCost(line: OrderLineDraft): number {
    const product = this.products.find((p) => p.id === line.productId);
    return resolveProductUnitCost(product, this.products);
  }

  lineStockHint(line: OrderLineDraft): string | null {
    const product = this.products.find((p) => p.id === line.productId);
    return orderLineStockHint(line, product, this.products);
  }

  addLine(): void {
    this.lines = [...this.lines, createEmptyLine(ServiceType.IMPRESION_3D)];
  }

  removeLine(index: number): void {
    if (this.lines.length === 1) {
      this.lines = [createEmptyLine(ServiceType.IMPRESION_3D)];
      return;
    }
    this.lines = this.lines.filter((_, i) => i !== index);
  }

  onSubmit(asDraft = false): void {
    const validLines = this.lines.filter((line) => isLineValid(line));
    const discount = discountPayloadFromMode(
      this.discountMode,
      this.discountPercent,
      this.discountAmount,
    );
    const items = buildOrderItems(validLines, this.products);
    const shared = {
      items,
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      ...(this.customerId.trim() ? { customerId: this.customerId.trim() } : {}),
    };

    if (this.isQuoteForm) {
      this.save.emit({
        ...shared,
        description: hasRichTextContent(this.description)
          ? sanitizeRichTextHtml(this.description)
          : '',
        status: asDraft ? QuoteStatus.BORRADOR : QuoteStatus.ENVIADO,
      } satisfies CreateQuotePayload);
      return;
    }

    this.save.emit({
      ...shared,
      services: deriveOrderServices(validLines),
      description: hasRichTextContent(this.description)
        ? sanitizeRichTextHtml(this.description)
        : undefined,
      notes: this.notes.trim() || undefined,
      dueDate: toOrderDueDate(this.dueDate),
    } satisfies CreateOrderPayload);
  }

  openNewCustomer(): void {
    this.formDialogs.openCustomer().subscribe((customer) => {
      if (!customer) return;
      this.customerCreated.emit(customer);
      this.customerId = customer.id;
    });
  }

  get dueDateError(): string {
    if (this.isQuoteForm || !this.dueDate) return '';
    return isDueDateAfterToday(this.dueDate) ? '' : DUE_DATE_AFTER_TODAY_MESSAGE;
  }

  get minDueDate(): string {
    return minimumDueDate();
  }

  canSubmit(): boolean {
    if (!this.lines.some((line) => isLineValid(line))) return false;
    if (
      plainTextFromHtml(this.description).length > this.descriptionMaxLength
    ) {
      return false;
    }
    if (this.isQuoteForm) return true;
    return (
      !!this.customerId.trim() &&
      !!this.dueDate &&
      !this.dueDateError
    );
  }

  private resetForm(): void {
    if (this.isQuoteForm && this.quote) {
      this.customerId = this.quote.customerId ?? '';
      this.description = this.quote.description ?? '';
      this.notes = '';
      this.lines = this.quote.items.map((item) => lineFromQuoteItem(item));
      this.hydrateFdmColorSelectors(this.lines);
      this.discountMode = discountModeFromValues(
        this.quote.discountPercent,
        this.quote.discountAmount,
      );
      this.discountPercent = this.quote.discountPercent ?? 0;
      this.discountAmount = this.quote.discountAmount ?? 0;
    } else if (this.presetQuote) {
      this.customerId = this.presetQuote.customerId ?? '';
      this.dueDate = defaultDueDate();
      this.description = this.presetQuote.description ?? '';
      this.notes = '';
      this.lines = this.presetQuote.items.map((item) => lineFromQuoteItem(item));
      this.hydrateFdmColorSelectors(this.lines);
      this.discountMode = discountModeFromValues(
        this.presetQuote.discountPercent,
        this.presetQuote.discountAmount,
      );
      this.discountPercent = this.presetQuote.discountPercent ?? 0;
      this.discountAmount = this.presetQuote.discountAmount ?? 0;
    } else if (this.order) {
      this.customerId = this.order.customerId ?? '';
      this.dueDate = toDateInputValue(this.order.dueDate);
      this.description = this.order.description ?? '';
      this.notes = this.order.notes ?? '';
      this.lines = this.order.items.map((item) => lineFromOrderItem(item));
      this.hydrateFdmColorSelectors(this.lines);
      this.discountMode = discountModeFromValues(
        this.order.discountPercent,
        this.order.discountAmount,
      );
      this.discountPercent = this.order.discountPercent ?? 0;
      this.discountAmount = this.order.discountAmount ?? 0;
    } else if (this.presetCartLines.length && this.products.length) {
      this.customerId = this.presetCustomerId;
      this.dueDate = defaultDueDate();
      this.description = '';
      this.notes = '';
      this.lines = orderLinesFromSaleCart(this.presetCartLines, this.products);
      this.discountMode = 'none';
      this.discountPercent = 0;
      this.discountAmount = 0;
    } else {
      this.customerId = this.presetCustomerId;
      this.dueDate = defaultDueDate();
      this.description = '';
      this.notes = '';
      this.lines = [createEmptyLine(ServiceType.IMPRESION_3D)];
      this.discountMode = 'none';
      this.discountPercent = 0;
      this.discountAmount = 0;
    }
    this.syncDesignLineCosts();
    this.syncAllDesignPrintLines();
    this.syncAllFdmLines({ preservePrice: this.isEditing });
    this.syncAllEstampadoLines({ preservePrice: this.isEditing });
  }

  private syncAllFdmLines(options?: { preservePrice?: boolean }): void {
    if (!this.generalSettings) return;
    for (const line of this.lines) {
      if (isImpresion3DLine(line.serviceType)) {
        this.syncFdmLine(line, options);
      }
    }
  }

  private syncAllEstampadoLines(options?: { preservePrice?: boolean }): void {
    if (!this.generalSettings) return;
    for (const line of this.lines) {
      if (isEstampadoLine(line.serviceType)) {
        this.syncEstampadoLine(line, options);
      }
    }
  }

  /** Con producto de catálogo la composición se rellena y queda bloqueada. */
  isCatalogLocked(line: OrderLineDraft): boolean {
    return !!line.productId?.trim();
  }

  /**
   * B11: al editar, asegurar filas de filamento con color normalizado
   * (Indistinto o el del producto) para que el selector se renderice.
   * No reemplaza el desglose completo (B2); solo hidrata color/filamentos faltantes.
   */
  private hydrateFdmColorSelectors(lines: OrderLineDraft[]): void {
    for (const line of lines) {
      if (!isImpresion3DLine(line.serviceType)) continue;
      if (!line.filaments?.length && line.productId?.trim()) {
        applyProductSpecsToFdmLine(
          line,
          this.products.find((p) => p.id === line.productId),
        );
      }
      if (line.filaments?.length) {
        line.filaments = normalizeFdmFilaments(line.filaments);
      } else {
        this.quoteFilaments(line);
      }
    }
  }

  private syncFdmLine(
    line: OrderLineDraft,
    options?: { preservePrice?: boolean },
  ): void {
    if (!this.generalSettings || !this.profitMargins) return;

    // Siempre costear (y sugerir precio) desde el formulario.
    if (isFdmQuoteConfigured(line)) {
      syncFdmQuotePricing(
        line,
        this.generalSettings,
        this.costCalculator,
        impresion3DMargin(this.profitMargins),
        options,
      );
      return;
    }

    if (!options?.preservePrice) {
      line.unitCost = 0;
      line.unitPrice = 0;
    }
  }

  private syncEstampadoLine(
    line: OrderLineDraft,
    options?: { preservePrice?: boolean },
  ): void {
    if (!this.generalSettings || !this.profitMargins) return;

    if (isEstampadoQuoteConfigured(line)) {
      syncEstampadoQuotePricing(
        line,
        this.generalSettings,
        this.costCalculator,
        estampadoMargin(this.profitMargins),
        options,
      );
      return;
    }

    if (!options?.preservePrice) {
      line.unitCost = 0;
      line.unitPrice = 0;
    }
  }

  private applyGeneralSettings(settings: GeneralSettings): void {
    this.generalSettings = settings;
    this.profitMargins = normalizeProfitMargins(settings.profitMargins);
  }

  private applyDesignBudget(line: OrderLineDraft): void {
    if (!this.profitMargins) return;
    const hours = Math.max(0, Number(line.budgetedHours) || 0);
    line.budgetedHours = hours;
    const cost = Math.round(this.serviceRate(line) * hours);
    line.unitCost = cost;
    const price = priceFromCostAndMargin(cost, this.designMarginFor(line));
    line.unitPrice = price;
    line.designUnitPrice = price;
    this.syncDesignPrintLine(line);
  }

  private syncDesignLineCosts(): void {
    if (!this.profitMargins) return;
    for (const line of this.lines) {
      if (!isDesignService(line.serviceType)) continue;
      if ((line.unitPrice ?? 0) <= 0 && (line.unitCost ?? 0) <= 0) {
        line.budgetedHours ??= 0;
        if ((line.budgetedHours ?? 0) > 0) {
          this.applyDesignBudget(line);
        } else {
          line.unitCost = 0;
          line.unitPrice = 0;
          line.designUnitPrice = 0;
        }
        continue;
      }
      const margin = this.designMarginFor(line);
      if (line.includesPrint) {
        if (line.designUnitPrice == null && line.unitPrice > 0) {
          line.designUnitPrice = Math.max(
            line.unitPrice - (line.printUnitPrice ?? 0),
            0,
          );
        }
        line.unitCost = costFromPriceAndMargin(
          line.designUnitPrice ?? 0,
          margin,
        );
        continue;
      }
      if (line.unitPrice > 0) {
        line.unitCost = costFromPriceAndMargin(line.unitPrice, margin);
        line.designUnitPrice = line.unitPrice;
      } else if ((line.unitCost ?? 0) > 0) {
        line.unitPrice = priceFromCostAndMargin(line.unitCost!, margin);
        line.designUnitPrice = line.unitPrice;
      } else {
        line.unitCost = 0;
      }
    }
  }

  private syncAllDesignPrintLines(): void {
    if (!this.generalSettings) return;
    for (const line of this.lines) {
      if (isDesignService(line.serviceType) && line.includesPrint) {
        syncDesignPrintPricing(line, this.generalSettings);
      }
    }
  }

  private syncDesignPrintLine(line: OrderLineDraft): void {
    if (!this.generalSettings || !line.includesPrint) {
      if (!line.includesPrint) {
        line.unitPrice = line.designUnitPrice ?? line.unitPrice;
      }
      return;
    }
    syncDesignPrintPricing(line, this.generalSettings);
  }
}
