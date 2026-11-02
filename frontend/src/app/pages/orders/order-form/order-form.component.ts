import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CreateOrderPayload,
  CreateOrderPaymentPayload,
  CostBreakdown,
  CreateQuotePayload,
  Customer,
  CustomerType,
  FdmFilamentLine,
  FilamentType,
  ProductType,
  Supply,
  GeneralSettings,
  ImpresoWithCost,
  Order,
  OrderLineDraft,
  PaymentMethod,
  PriceType,
  Product,
  Quote,
  QuoteStatus,
  SalesChannel,
  ServiceProfitMargins,
  ServiceType,
  TreasuryAccount,
  WholesaleDiscountSettings,
} from '../../../core/models';
import { SettingsService, SuppliesService } from '../../../core/services/settings.service';
import { ImpresosService } from '../../../core/services/impresos.service';
import {
  ProductCostCalculationService,
} from '../../../core/services/product-cost-calculation.service';
import {
  DbFormComponent,
  DbFormErrorComponent,
  DbFormFooterComponent,
  DbFormGridFullComponent,
  DbTextareaComponent,
  DbRichTextEditorComponent,
  DbButtonComponent,
} from '@general-components';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import {
  buildOrderItems,
  calculateLinePriceTotal,
  deriveOrderServices,
  isLineBillable,
  createEmptyLine,
  ensureLineUiId,
  DUE_DATE_AFTER_TODAY_MESSAGE,
  defaultDueDate,
  isDesignService,
  isDueDateAfterToday,
  minimumDueDate,
  isGraphicDesignService,
  isLineBlank,
  isLineValid,
  lineFromOrderItem,
  lineConceptError,
  lineQuantityError,
  lineUnitPriceError,
  orderLinesFromSaleCart,
  orderLineStockHint,
  ORDER_DESCRIPTION_MAX_LENGTH,
  serviceTypeOptions,
  toDateInputValue,
  toOrderDueDate,
} from '../../../shared/utils/order.helpers';
import { isDesignPrintConfigured } from '../../../shared/utils/design-print.util';
import {
  calculateOrderLinesCost,
  resolveProductUnitCost,
} from '../../../shared/utils/product.helpers';
import {
  normalizeProfitMargins,
  priceFromCostAndMargin,
  getMarginForService,
} from '../../../shared/utils/pricing.util';
import {
  SERVICE_TYPE_LABELS,
} from '../../../shared/constants/labels';
import { DEPOSIT_FACTOR } from '../../../shared/utils/quote-document.util';
import {
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
  printQuantity,
  resolvePrintDimensions,
  totalEstampadoPressMinutes,
} from '../../../shared/utils/estampado.helpers';
import {
  calculateMachineOverhead,
} from '../../../shared/utils/machine-profile.util';
import { plainTextFromHtml, hasRichTextContent, sanitizeRichTextHtml } from '../../../shared/utils/rich-text.util';
import { MediaUploadService } from '../../../core/services/media-upload.service';
import { DbFileUploadFn } from '../../../components/dashboard-form/db-file-upload/db-file-upload.types';
import { firstValueFrom } from 'rxjs';
import {
  DiscountMode,
  DISCOUNT_PERCENT_MAX,
  calculateDiscountValue,
  calculateTotalWithDiscount,
  clampDiscountAmount,
  clampDiscountPercent,
  discountAmountClampMessage,
  discountModeFromValues,
  discountPayloadFromMode,
  discountPercentClampMessage,
} from '../../../shared/utils/discount.util';
import {
  DbSegmentOption,
  DbSelectOption,
} from '@general-components';
import {
  syncDesignPrintPricing,
} from '../../../shared/utils/design-print.util';
import {
  labelsToSelectOptions,
  paperTypeOptions,
} from '../../../shared/utils/select-options';
import {
  normalizeWholesaleDiscount,
  wholesalePriceFromList,
} from '../../../shared/utils/wholesale-example.util';
import {
  isWholesaleMarginBelowArea,
  lineListSubtotal,
  lineListUnitPrice,
  linePreviewSubtotal,
  meetsWholesaleMinimum,
  wholesaleAppliesToService,
  wholesaleMarginPercentOnCost,
  wouldApplyWholesale,
} from '../../../shared/utils/order-wholesale-preview.util';
import { defaultAccountForMethod } from '../../../shared/utils/treasury-account.util';
import {
  PAYMENT_METHOD_LABELS,
  SALES_CHANNEL_LABELS,
  TREASURY_ACCOUNT_LABELS,
} from '../../../shared/utils/v1-labels.util';
import {
  applyProductSpecsToFdmLine,
  impresion3DMargin,
  isFdmQuoteConfigured,
  isImpresion3DLine,
  isResinQuoteConfigured,
  isResinQuoteLine,
  syncFdmQuotePricing,
} from '../../../shared/utils/order-fdm-quote.util';
import {
  estampadoMargin,
  hydrateEstampadoQuoteSpecs,
  isEstampadoLine,
  isEstampadoQuoteConfigured,
  syncEstampadoQuotePricing,
} from '../../../shared/utils/order-estampado-quote.util';
import {
  createEmptyFdmFilamentLine,
  normalizeFdmFilaments,
} from '../../../shared/utils/fdm.helpers';
import { lineFromQuoteItem } from '../../../shared/utils/quote.helpers';
import {
  resolveOrderQuoteCureMinutes,
  resolveOrderQuoteWashMinutes,
} from '../../../components/order-quote-composition.util';
import { OrderFormLineComponent } from './linea/order-form-line.component';
import { OrderFormPartyComponent } from './order-form-party/order-form-party.component';
import { OrderFormOrderSummaryComponent } from './order-form-order-summary/order-form-order-summary.component';
import type { WholesaleMinimumNotice } from './order-form-party/order-form-party.component';

export type OrderFormVariant = 'order' | 'quote';

export type OrderFormSavePayload = CreateOrderPayload | CreateQuotePayload;

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DbFormComponent,
    DbFormGridFullComponent,
    DbTextareaComponent,
    DbRichTextEditorComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
    OrderFormLineComponent,
    OrderFormPartyComponent,
    OrderFormOrderSummaryComponent,
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

  readonly paperTypeOptions = paperTypeOptions();
  readonly PriceType = PriceType;
  readonly PaymentMethod = PaymentMethod;

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
  /** El dialog refresca título/subtítulo (mayorista / revendedor). */
  @Output() uiMetaChange = new EventEmitter<void>();

  customerId = '';
  dueDate = defaultDueDate();
  description = '';
  notes = '';
  lines: OrderLineDraft[] = [createEmptyLine(ServiceType.IMPRESION_3D)];
  discountMode: DiscountMode = 'none';
  discountPercent = 0;
  discountAmount = 0;
  /** Q3: aviso cuando el clamp ajustó el valor ingresado. */
  discountClampHint = '';
  /** null hasta que carguen Ajustes reales; no usar defaults inventados en hints. */
  profitMargins: ServiceProfitMargins | null = null;
  generalSettings: GeneralSettings | null = null;
  wholesaleDiscount: WholesaleDiscountSettings = normalizeWholesaleDiscount(null);
  impresos: ImpresoWithCost[] = [];
  supplies: Supply[] = [];
  readonly depositPercent = Math.round(DEPOSIT_FACTOR * 100);

  priceType: PriceType = PriceType.LISTA;
  salesChannel: SalesChannel | null = null;
  /** El usuario eligió tipo de precio a mano; no pisar al cambiar cliente. */
  private priceTypeManual = false;

  /** Seña solo en alta de pedido. */
  depositAmountInput: number | null = null;
  depositMethod: PaymentMethod = PaymentMethod.TRANSFERENCIA;
  depositAccount: TreasuryAccount = TreasuryAccount.BANCO;
  depositFeeInput: number | null = null;
  private depositAmountTouched = false;

  /**
   * Mobile «DETALLES»: plegado si descripción y notas están vacías.
   * En desktop los campos se muestran siempre (CSS).
   */
  detailsExpanded = false;

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
  readonly isEstampadoLine = isEstampadoLine;

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

  /** Dock mobile: mismo submit + total ya calculado. */
  get submitLabelMobile(): string {
    if (this.loading) return 'Guardando...';
    const totalLabel = this.money(this.total);
    if (this.isEditing) return `Guardar cambios · ${totalLabel}`;
    if (this.presetQuote) return `Generar pedido · ${totalLabel}`;
    return `Crear pedido · ${totalLabel}`;
  }

  /**
   * Faltantes del pedido (mismas reglas que `canSubmit` en modo order).
   * Vacío ⇒ se puede guardar.
   */
  get submitMissing(): string[] {
    if (this.isQuoteForm) return [];
    const missing: string[] = [];

    if (!this.customerId.trim()) missing.push('cliente');
    if (!this.dueDate) {
      missing.push('fecha de entrega');
    } else if (this.dueDateError) {
      missing.push('fecha de entrega válida');
    }

    const relevant = this.lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => !isLineBlank(line));

    if (!relevant.length) {
      missing.push('al menos un producto');
    } else {
      for (const { line, index } of relevant) {
        if (isLineValid(line)) continue;
        missing.push(...this.lineMissingReasons(line, index + 1));
      }
    }

    if (
      plainTextFromHtml(this.description).length > this.descriptionMaxLength
    ) {
      missing.push('descripción más corta');
    }

    return missing;
  }

  get submitMissingLabel(): string {
    const items = this.submitMissing;
    if (!items.length) return '';
    return `Falta: ${items.join(', ')}`;
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

  get selectedCustomer(): Customer | undefined {
    return this.customers.find((c) => c.id === this.customerId);
  }

  get isResellerCustomer(): boolean {
    return this.selectedCustomer?.type === CustomerType.REVENDEDOR;
  }

  get resellerPillLabel(): string {
    if (!this.isResellerCustomer) return '';
    const percent = this.wholesaleDiscount.percent;
    return `Revendedor · −${percent}%`;
  }

  get salesChannelOptions(): DbSelectOption[] {
    return [
      { value: '', label: 'Sin canal' },
      ...labelsToSelectOptions(SALES_CHANNEL_LABELS),
    ];
  }

  get priceTypeOptions(): DbSegmentOption<PriceType>[] {
    const percent = this.wholesaleDiscount.percent;
    return [
      { value: PriceType.LISTA, label: 'Lista' },
      {
        value: PriceType.MAYORISTA,
        label: percent > 0 ? `Mayorista −${percent}%` : 'Mayorista',
      },
    ];
  }

  get depositMethodOptions(): DbSegmentOption<PaymentMethod>[] {
    return labelsToSelectOptions(PAYMENT_METHOD_LABELS);
  }

  get depositAccountOptions(): DbSelectOption[] {
    return labelsToSelectOptions(TREASURY_ACCOUNT_LABELS);
  }

  get dueDateBusinessDaysHint(): string {
    if (!this.dueDate) return '';
    const days = this.countCalendarDaysFromToday(this.dueDate);
    if (days <= 0) return '';
    const noun = days === 1 ? 'día' : 'días';
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

  get validLines(): OrderLineDraft[] {
    return this.lines.filter((line) => isLineValid(line));
  }

  get billableLines(): OrderLineDraft[] {
    return this.lines.filter((line) => isLineBillable(line));
  }

  /** Subtotal a precio de lista (líneas del form editan lista). */
  get listSubtotal(): number {
    return this.billableLines.reduce(
      (sum, line) => sum + lineListSubtotal(line),
      0,
    );
  }

  get subtotal(): number {
    return this.chargedSubtotal;
  }

  get wholesaleAppliedPreview(): boolean {
    return wouldApplyWholesale({
      priceType: this.priceType,
      listSubtotal: this.listSubtotal,
      customerMinimum: this.selectedCustomer?.wholesaleMinimum,
      settings: this.wholesaleDiscount,
    });
  }

  /** Monto de productos elegibles al descuento mayorista (a lista). */
  get wholesaleProductsBase(): number {
    if (!this.wholesaleAppliedPreview) return 0;
    return this.billableLines.reduce((sum, line) => {
      if (!wholesaleAppliesToService(line.serviceType, this.wholesaleDiscount)) {
        return sum;
      }
      return sum + lineListSubtotal(line);
    }, 0);
  }

  get wholesaleDiscountAmount(): number {
    if (!this.wholesaleAppliedPreview) return 0;
    return this.billableLines.reduce((sum, line) => {
      if (!wholesaleAppliesToService(line.serviceType, this.wholesaleDiscount)) {
        return sum;
      }
      const list = lineListUnitPrice(line);
      const wholesale = wholesalePriceFromList(
        list,
        this.wholesaleDiscount.percent,
      );
      const qty = Math.max(0, Number(line.quantity) || 0);
      return sum + Math.round((list - wholesale) * qty);
    }, 0);
  }

  /** Subtotal cobrado (lista − mayorista) antes del descuento manual. */
  get chargedSubtotal(): number {
    return this.billableLines.reduce(
      (sum, line) =>
        sum +
        linePreviewSubtotal(
          line,
          this.wholesaleAppliedPreview,
          this.wholesaleDiscount,
        ),
      0,
    );
  }

  get discountPercentMax(): number {
    return DISCOUNT_PERCENT_MAX;
  }

  /** Tope de descuento en $: subtotal cobrado − 1 (0 si no hay subtotal). */
  get discountAmountMax(): number {
    return Math.max(0, Math.round(this.chargedSubtotal) - 1);
  }

  get discountApplied(): number {
    const discount = discountPayloadFromMode(
      this.discountMode,
      this.discountPercent,
      this.discountAmount,
      this.chargedSubtotal,
    );
    return calculateDiscountValue(
      this.chargedSubtotal,
      discount.discountPercent,
      discount.discountAmount,
    );
  }

  get total(): number {
    const discount = discountPayloadFromMode(
      this.discountMode,
      this.discountPercent,
      this.discountAmount,
      this.chargedSubtotal,
    );
    return calculateTotalWithDiscount(
      this.chargedSubtotal,
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

  get paymentFeePreview(): number {
    if (this.isQuoteForm || this.isEditing) return 0;
    return Math.max(0, Number(this.depositFeeInput) || 0);
  }

  get profit(): number {
    return this.total - this.totalCost - this.paymentFeePreview;
  }

  get profitPercentOnCost(): number {
    if (!(this.totalCost > 0)) return 0;
    return Math.round((this.profit / this.totalCost) * 100);
  }

  get listProfit(): number {
    return this.listSubtotal - this.discountApplied - this.totalCost;
  }

  get resellerSavings(): number {
    return this.wholesaleDiscountAmount;
  }

  get depositAmount(): number {
    return Math.round(this.total * DEPOSIT_FACTOR);
  }

  get depositAmountValue(): number | null {
    if (this.depositAmountTouched) return this.depositAmountInput;
    return this.depositAmountInput ?? this.depositAmount;
  }

  get balanceAfterDeposit(): number {
    const deposit = Math.max(0, Number(this.depositAmountValue) || 0);
    return Math.max(0, Math.round(this.total - deposit));
  }

  get wholesaleMinimumNotice(): WholesaleMinimumNotice {
    if (this.priceType !== PriceType.MAYORISTA) {
      return null;
    }
    // Recién con al menos una línea con precio (no apenas se elige cliente).
    const hasPricedLine = this.lines.some((line) => {
      if (isLineBlank(line)) return false;
      if (isDesignService(line.serviceType)) {
        return (Number(line.designUnitPrice ?? line.unitPrice) || 0) > 0;
      }
      return (Number(line.unitPrice) || 0) > 0;
    });
    if (!hasPricedLine) return null;

    const minimum = this.selectedCustomer?.wholesaleMinimum;
    if (minimum == null || !Number.isFinite(Number(minimum))) {
      return null;
    }
    const min = Number(minimum);
    if (meetsWholesaleMinimum(this.listSubtotal, min)) {
      return {
        kind: 'ok',
        message: `Supera la compra mínima mayorista de ${this.money(min)}.`,
      };
    }
    return {
      kind: 'warn',
      message: `No llega a la compra mínima mayorista de ${this.money(min)}: se cobra precio de lista.`,
    };
  }

  /**
   * Aviso global debajo de las líneas cuando hay productos con margen por
   * mayor por debajo del margen del área (mismo cálculo que en cada línea).
   */
  get lowWholesaleMarginNotice(): {
    message: string;
    namesLabel: string;
  } | null {
    if (!this.wholesaleAppliedPreview || !this.profitMargins) {
      return null;
    }

    const items: Array<{ name: string; margin: number; areaMargin: number }> =
      [];

    for (let index = 0; index < this.billableLines.length; index++) {
      const line = this.billableLines[index];
      if (!wholesaleAppliesToService(line.serviceType, this.wholesaleDiscount)) {
        continue;
      }
      const list = lineListUnitPrice(line);
      const wholesale = wholesalePriceFromList(
        list,
        this.wholesaleDiscount.percent,
      );
      const unitCost = this.lineUnitCost(line);
      const area = getMarginForService(line.serviceType, this.profitMargins);
      if (!isWholesaleMarginBelowArea(wholesale, unitCost, area)) {
        continue;
      }
      items.push({
        name: this.lineTitle(line, index),
        margin: wholesaleMarginPercentOnCost(wholesale, unitCost),
        areaMargin: area,
      });
    }

    if (!items.length) return null;

    const count = items.length;
    const head =
      count === 1
        ? '1 producto queda con margen bajo por mayor'
        : `${count} productos quedan con margen bajo por mayor`;

    const namesJoined =
      count === 1
        ? items[0].name
        : count === 2
          ? `${items[0].name} y ${items[1].name}`
          : `${items
              .slice(0, -1)
              .map((item) => item.name)
              .join(', ')} y ${items[count - 1].name}`;

    const sameMargin = items.every((item) => item.margin === items[0].margin);
    const namesLabel = sameMargin
      ? `${namesJoined}, ${items[0].margin}%`
      : items.map((item) => `${item.name} ${item.margin}%`).join(', ');

    const areaMargin = items[0].areaMargin;
    const discount = this.wholesaleDiscount.percent;
    return {
      message: `${head} (${namesLabel}). Su margen de lista es del ${areaMargin}%: con −${discount}% quedan cerca del costo.`,
      namesLabel,
    };
  }

  /** Subtítulo del modal según tipo de precio / variante. */
  get modalSubtitle(): string {
    const percent = this.wholesaleDiscount.percent;
    if (this.isQuoteForm) {
      if (this.priceType === PriceType.MAYORISTA) {
        return `Cotización para un revendedor · −${percent}% sobre el precio de lista`;
      }
      if (this.isEditing) {
        return 'Editá la cotización antes de confirmar el pedido.';
      }
      return 'Cotización para un cliente antes de confirmar el pedido';
    }
    if (this.priceType === PriceType.MAYORISTA) {
      return 'Pedido de revendedor · cada línea genera tareas en la cola de trabajo';
    }
    if (this.presetQuote) {
      return 'Revisá las líneas del presupuesto antes de generar el pedido.';
    }
    return 'Podés mezclar servicios en el mismo pedido. Cada línea genera tareas en la cola de trabajo.';
  }

  get showDepositBlock(): boolean {
    return !this.isQuoteForm && !this.isEditing;
  }

  lineTitle(line: OrderLineDraft, index: number): string {
    return (
      line.customName?.trim() ||
      this.productForLine(line)?.name ||
      `Línea ${index + 1}`
    );
  }

  onLineChanged(): void {
    // Mutaciones in-place en la línea; el resumen/totales se recalculan al leer getters.
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

  /** Catálogo RESINA o presupuesto manual en modo resina. */
  isResinProductLine(line: OrderLineDraft): boolean {
    return isResinQuoteLine(line, this.productForLine(line));
  }

  fdmBreakdown(line: OrderLineDraft): CostBreakdown | null {
    if (!this.generalSettings) return null;
    const product = this.productForLine(line);
    const isResin = this.isResinProductLine(line);
    const resinType =
      product && 'resinType' in product && product.resinType
        ? product.resinType
        : line.resinType;
    const resinReady =
      isResin &&
      !!resinType &&
      ((Number(line.grams) || 0) > 0 || (Number(line.printTimeHours) || 0) > 0);
    if (!isResin && !isFdmQuoteConfigured(line)) return null;
    if (isResin && !resinReady) return null;

    // N1: FDM sin marca → promedio del tipo (igual que el selector).
    const filamentsForQuote = isResin
      ? undefined
      : (line.filaments ?? []).map((row) => ({ ...row, brand: undefined }));

    return this.costCalculator.calculateCost(
      {
        type: isResin ? ProductType.RESINA : ProductType.FDM,
        grams: Number(line.grams) || 0,
        printTimeHours: Number(line.printTimeHours) || 0,
        workTimeHours: Number(line.workTimeHours) || 0,
        filamentType: isResin
          ? undefined
          : (line.filamentType as FilamentType),
        filaments: filamentsForQuote?.length ? filamentsForQuote : undefined,
        brand:
          isResin && product && 'brand' in product
            ? product.brand
            : undefined,
        resinType: isResin ? resinType : undefined,
        washMinutes: isResin
          ? resolveOrderQuoteWashMinutes(line, product)
          : undefined,
        cureMinutes: isResin
          ? resolveOrderQuoteCureMinutes(line, product)
          : undefined,
      },
      { settings: this.generalSettings, supplies: this.suppliesForCost() },
    );
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

  chargeModeFor(line: OrderLineDraft): 'hours' | 'fixed' {
    if (line.chargeMode) return line.chargeMode;
    return isGraphicDesignService(line.serviceType) ? 'fixed' : 'hours';
  }


  estampadoCosts(line: OrderLineDraft): {
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
    const pressMinutes = totalEstampadoPressMinutes(line.estampadoPressCycles);
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
    const labor = Math.round(
      (Number(line.workTimeHours) || 0) *
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

  onLinkPrintChange(
    line: OrderLineDraft,
    checked: boolean,
    index: number,
  ): void {
    line.linkPrint = checked;
    const modelUiId = ensureLineUiId(line);

    if (!checked) {
      this.lines = this.lines.filter(
        (row) => row.linkedModelUiId !== modelUiId,
      );
      return;
    }

    if (this.lines.some((row) => row.linkedModelUiId === modelUiId)) {
      return;
    }

    const printLine = createEmptyLine(ServiceType.IMPRESION_3D);
    printLine.linkedModelUiId = modelUiId;
    const concept = line.customName?.trim();
    printLine.customName = concept
      ? `Impresión · ${concept}`
      : 'Impresión de la pieza';
    printLine.quantity = line.quantity || 1;

    this.lines = [
      ...this.lines.slice(0, index + 1),
      printLine,
      ...this.lines.slice(index + 1),
    ];
  }


  /**
   * Insumos para costeo. Si el array del form aún está vacío, no pasar []
   * (taparía el store en ProductCostCalculationService y el alcohol sale $0).
   */
  private suppliesForCost(): Supply[] | undefined {
    return this.supplies.length ? this.supplies : undefined;
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
      this.syncDesignLineCosts({ preserveCost: this.isEditing });
      this.syncAllDesignPrintLines();
      this.syncAllFdmLines({
        preservePrice: this.isEditing,
        preserveCost: this.isEditing,
      });
      this.syncAllEstampadoLines({
        preservePrice: this.isEditing,
        preserveCost: this.isEditing,
      });
    });
    this.impresosService.getImpresos().subscribe((items) => {
      this.impresos = items;
      // B3: re-hidratar y costear cuando llegan impresos (dims/papel).
      this.hydrateEstampadoQuoteLines(this.lines);
      this.syncAllEstampadoLines({
        preservePrice: this.isEditing,
        preserveCost: this.isEditing,
      });
    });
    if (this.isQuoteForm) {
      // Todos los insumos: alcohol de lavado (Ajustes) + estampado.
      this.suppliesService
        .watchSupplies()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((items) => {
          this.supplies = items;
          // B3: re-costear con precios de insumos (antes unitCost podía quedar en 0).
          this.syncAllEstampadoLines({
            preservePrice: this.isEditing,
            preserveCost: this.isEditing,
          });
          this.syncAllFdmLines({
            preservePrice: this.isEditing,
            preserveCost: this.isEditing,
          });
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
      this.uiMetaChange.emit();
      return;
    }

    // Catálogo de clientes llegó/actualizó: proponer mayorista + pill sin pisar líneas.
    if (changes['customers']) {
      this.applyResellerPriceTypeIfNeeded();
      this.uiMetaChange.emit();
    }
  }

  /** Si el usuario no eligió tipo a mano, alinea con el type del cliente. */
  private applyResellerPriceTypeIfNeeded(): void {
    if (this.priceTypeManual) return;
    this.priceType = this.isResellerCustomer
      ? PriceType.MAYORISTA
      : PriceType.LISTA;
  }

  serviceLabel(serviceType: ServiceType): string {
    return SERVICE_TYPE_LABELS[serviceType];
  }

  lineServiceOptions() {
    return this.serviceTypeOptions;
  }

  productForLine(line: OrderLineDraft): Product | undefined {
    return line.productId
      ? this.products.find((p) => p.id === line.productId)
      : undefined;
  }

  lineUnitCost(line: OrderLineDraft): number {
    // B3: si el desglose de estampado suma > 0 pero unitCost quedó en 0
    // (sync temprano sin insumos/impresos), mostrar la suma del desglose.
    if (
      isEstampadoLine(line.serviceType) &&
      isEstampadoQuoteConfigured(line)
    ) {
      if (line.unitCost != null && line.unitCost > 0) {
        return line.unitCost;
      }
      const est = this.estampadoCosts(line);
      const fromBreakdown =
        est.prints +
        est.supplies +
        est.press +
        est.labor +
        est.errorMargin;
      if (fromBreakdown > 0) return fromBreakdown;
    }
    if (line.unitCost != null && line.unitCost >= 0) {
      return line.unitCost;
    }
    return this.productUnitCost(line);
  }

  setDiscountMode(mode: DiscountMode): void {
    this.discountMode = mode;
    this.discountClampHint = '';
    if (mode === 'none') {
      this.discountPercent = 0;
      this.discountAmount = 0;
      return;
    }
    this.clampDiscountFields();
  }

  onDiscountPercentChange(raw: number | string): void {
    const n = Number(raw);
    this.discountClampHint = discountPercentClampMessage(n);
    this.discountPercent = clampDiscountPercent(n);
  }

  onDiscountAmountChange(raw: number | string): void {
    const n = Number(raw);
    const base = this.chargedSubtotal;
    this.discountClampHint = discountAmountClampMessage(n, base);
    this.discountAmount = clampDiscountAmount(n, base);
  }

  /** Ajusta %/$ al rango válido (tipeo, pegado o cambio de subtotal). */
  private clampDiscountFields(): void {
    if (this.discountMode === 'percent') {
      const before = this.discountPercent;
      this.discountPercent = clampDiscountPercent(before);
      if (this.discountPercent !== before) {
        this.discountClampHint = discountPercentClampMessage(before);
      }
    } else if (this.discountMode === 'amount') {
      const before = this.discountAmount;
      const base = this.chargedSubtotal;
      this.discountAmount = clampDiscountAmount(before, base);
      if (this.discountAmount !== before) {
        this.discountClampHint = discountAmountClampMessage(before, base);
      }
    } else {
      this.discountClampHint = '';
    }
  }

  onCustomerIdChange(customerId: string): void {
    this.customerId = customerId;
    this.applyResellerPriceTypeIfNeeded();
    this.uiMetaChange.emit();
  }

  onPriceTypeChange(value: PriceType): void {
    this.priceType = value;
    this.priceTypeManual = true;
    this.uiMetaChange.emit();
  }

  onSalesChannelChange(value: string | null): void {
    this.salesChannel =
      value && Object.values(SalesChannel).includes(value as SalesChannel)
        ? (value as SalesChannel)
        : null;
  }

  onDepositAmountChange(raw: number | null): void {
    this.depositAmountTouched = true;
    this.depositAmountInput =
      raw === null || raw === ('' as unknown) ? null : Number(raw);
  }

  onDepositMethodChange(method: PaymentMethod): void {
    this.depositMethod = method;
    this.depositAccount = defaultAccountForMethod(method);
  }

  onDepositAccountChange(value: string): void {
    if (Object.values(TreasuryAccount).includes(value as TreasuryAccount)) {
      this.depositAccount = value as TreasuryAccount;
    }
  }

  onDepositFeeChange(raw: number | null): void {
    this.depositFeeInput =
      raw === null || raw === ('' as unknown) ? null : Number(raw);
  }

  /**
   * Seña a registrar tras crear el pedido (alta). Null si monto 0/vacío.
   * Lo consume el dialog después del create.
   */
  getInitialDeposit(): CreateOrderPaymentPayload | null {
    if (!this.showDepositBlock) return null;
    const amount = Number(this.depositAmountValue);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const fee = Number(this.depositFeeInput);
    return {
      amount: Math.round(amount),
      deposit: true,
      method: this.depositMethod,
      account: this.depositAccount,
      ...(Number.isFinite(fee) && fee > 0 ? { fee: Math.round(fee) } : {}),
    };
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

  designRateMissingHint(line: OrderLineDraft): string | null {
    if (!isDesignService(line.serviceType)) return null;
    if (this.serviceRate(line) > 0) return null;
    return isGraphicDesignService(line.serviceType)
      ? 'Tarifa de diseño sin cargar en Ajustes'
      : 'Tarifa de modelado sin cargar en Ajustes';
  }

  /** §10: la entrega sugerida son 7 días de calendario, no días hábiles. */
  private countCalendarDaysFromToday(dueDateInput: string): number {
    const due = new Date(`${dueDateInput}T12:00:00`);
    if (Number.isNaN(due.getTime())) return 0;
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    if (due < start) return 0;
    return Math.round((due.getTime() - start.getTime()) / 86_400_000);
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
    const removed = this.lines[index];
    const linkedId = removed?.uiId;
    this.lines = this.lines.filter((line, i) => {
      if (i === index) return false;
      if (linkedId && line.linkedModelUiId === linkedId) return false;
      return true;
    });
    if (!this.lines.length) {
      this.lines = [createEmptyLine(ServiceType.IMPRESION_3D)];
    }
  }

  onSubmit(asDraft = false): void {
    this.clampDiscountFields();
    if (!this.canSubmit(asDraft)) return;
    const validLines = this.lines.filter((line) => isLineValid(line));
    const discount = discountPayloadFromMode(
      this.discountMode,
      this.discountPercent,
      this.discountAmount,
      this.subtotal,
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
        priceType: this.priceType,
        salesChannel: this.salesChannel,
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
      priceType: this.priceType,
      salesChannel: this.salesChannel,
    } satisfies CreateOrderPayload);
  }

  openNewCustomer(): void {
    this.formDialogs.openCustomer().subscribe((customer) => {
      if (!customer) return;
      this.customerCreated.emit(customer);
      this.onCustomerIdChange(customer.id);
    });
  }

  get dueDateError(): string {
    if (this.isQuoteForm || !this.dueDate) return '';
    return isDueDateAfterToday(this.dueDate) ? '' : DUE_DATE_AFTER_TODAY_MESSAGE;
  }

  get minDueDate(): string {
    return minimumDueDate();
  }

  /** True tras interacción del usuario; ignora defaults/sync al abrir. */
  private userEdited = false;

  /** True si el usuario tocó el form y se perderían cambios al cerrar. */
  hasUnsavedChanges(): boolean {
    return this.userEdited;
  }

  @HostListener('input')
  @HostListener('change')
  onFormFieldEdit(): void {
    this.userEdited = true;
  }

  @HostListener('click', ['$event'])
  onFormClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-discard-safe]')) return;
    if (
      target.closest(
        'button, [role="button"], input, select, textarea, .discount-segment, .quote-chip, .quote-charge__segment',
      )
    ) {
      this.userEdited = true;
    }
  }

  /** Borrador: sin cliente OK. Crear/Enviado: exige cliente. */
  canSubmit(asDraft = false): boolean {
    this.clampDiscountFields();
    if (this.isQuoteForm) {
      const relevant = this.lines.filter((line) => !isLineBlank(line));
      if (!relevant.length || !relevant.every((line) => isLineValid(line))) {
        return false;
      }
      if (
        plainTextFromHtml(this.description).length > this.descriptionMaxLength
      ) {
        return false;
      }
      if (asDraft) return true;
      return !!this.customerId.trim();
    }
    return this.submitMissing.length === 0;
  }

  expandDetails(): void {
    this.detailsExpanded = true;
  }

  private syncDetailsExpanded(): void {
    this.detailsExpanded =
      hasRichTextContent(this.description) || !!this.notes?.trim();
  }

  /**
   * Motivos legibles por línea inválida, reusando los mismos chequeos
   * que `isLineValid` / mensajes de error de línea.
   */
  private lineMissingReasons(line: OrderLineDraft, lineNumber: number): string[] {
    const reasons: string[] = [];
    const n = lineNumber;

    if (lineQuantityError(line.quantity)) {
      reasons.push(`cantidad de la línea ${n}`);
    }
    if (lineConceptError(line)) {
      reasons.push(`concepto de la línea ${n}`);
    }
    if (lineUnitPriceError(line)) {
      reasons.push(`precio de la línea ${n}`);
    }

    if (isDesignService(line.serviceType)) {
      if (line.includesPrint && !isDesignPrintConfigured(line)) {
        reasons.push(`impresión de la línea ${n}`);
      }
    } else if (isImpresion3DLine(line.serviceType) && !line.productId?.trim()) {
      const product = this.productForLine(line);
      const resin = isResinQuoteLine(line, product);
      const configured = resin
        ? isResinQuoteConfigured(line)
        : isFdmQuoteConfigured(line);
      if (!configured) {
        reasons.push(`gramos de la línea ${n}`);
      }
    } else if (isEstampadoLine(line.serviceType) && !line.productId?.trim()) {
      if (!isEstampadoQuoteConfigured(line)) {
        reasons.push(`composición de la línea ${n}`);
      }
    } else if (
      !isDesignService(line.serviceType) &&
      !isImpresion3DLine(line.serviceType) &&
      !isEstampadoLine(line.serviceType) &&
      !line.productId?.trim()
    ) {
      reasons.push(`producto de la línea ${n}`);
    }

    if (!reasons.length) {
      reasons.push(`datos de la línea ${n}`);
    }
    return reasons;
  }

  get quoteNeedsCustomerHint(): string {
    if (!this.isQuoteForm || this.customerId.trim()) return '';
    return 'Elegí un cliente para crear el presupuesto (Enviado). El borrador puede guardarse sin cliente.';
  }

  private resetForm(): void {
    this.priceTypeManual = false;
    this.depositAmountTouched = false;
    this.depositAmountInput = null;
    this.depositFeeInput = null;
    this.depositMethod = PaymentMethod.TRANSFERENCIA;
    this.depositAccount = defaultAccountForMethod(this.depositMethod);

    if (this.isQuoteForm && this.quote) {
      this.customerId = this.quote.customerId ?? '';
      this.description = this.quote.description ?? '';
      this.notes = '';
      this.lines = this.quote.items.map((item) => lineFromQuoteItem(item));
      this.hydrateFdmColorSelectors(this.lines);
      this.hydrateEstampadoQuoteLines(this.lines);
      this.discountMode = discountModeFromValues(
        this.quote.discountPercent,
        this.quote.discountAmount,
      );
      this.discountPercent = this.quote.discountPercent ?? 0;
      this.discountAmount = this.quote.discountAmount ?? 0;
      this.priceType = this.quote.priceType ?? PriceType.LISTA;
      this.salesChannel = this.quote.salesChannel ?? null;
      this.priceTypeManual = !!this.quote.priceType;
      if (!this.priceTypeManual && this.isResellerCustomer) {
        this.priceType = PriceType.MAYORISTA;
      }
    } else if (this.presetQuote) {
      this.customerId = this.presetQuote.customerId ?? '';
      this.dueDate = defaultDueDate();
      this.description = this.presetQuote.description ?? '';
      this.notes = '';
      this.lines = this.presetQuote.items.map((item) => lineFromQuoteItem(item));
      this.hydrateFdmColorSelectors(this.lines);
      this.hydrateEstampadoQuoteLines(this.lines);
      this.discountMode = discountModeFromValues(
        this.presetQuote.discountPercent,
        this.presetQuote.discountAmount,
      );
      this.discountPercent = this.presetQuote.discountPercent ?? 0;
      this.discountAmount = this.presetQuote.discountAmount ?? 0;
      this.priceType = this.presetQuote.priceType ?? PriceType.LISTA;
      this.salesChannel = this.presetQuote.salesChannel ?? null;
      this.priceTypeManual = !!this.presetQuote.priceType;
      if (!this.priceTypeManual && this.isResellerCustomer) {
        this.priceType = PriceType.MAYORISTA;
      }
    } else if (this.order) {
      this.customerId = this.order.customerId ?? '';
      this.dueDate = toDateInputValue(this.order.dueDate);
      this.description = this.order.description ?? '';
      this.notes = this.order.notes ?? '';
      this.lines = this.order.items.map((item) => lineFromOrderItem(item));
      this.hydrateFdmColorSelectors(this.lines);
      this.hydrateEstampadoQuoteLines(this.lines);
      this.discountMode = discountModeFromValues(
        this.order.discountPercent,
        this.order.discountAmount,
      );
      this.discountPercent = this.order.discountPercent ?? 0;
      this.discountAmount = this.order.discountAmount ?? 0;
      this.priceType = this.order.priceType ?? PriceType.LISTA;
      this.salesChannel = this.order.salesChannel ?? null;
      this.priceTypeManual = !!this.order.priceType;
      if (!this.priceTypeManual && this.isResellerCustomer) {
        this.priceType = PriceType.MAYORISTA;
      }
    } else if (this.presetCartLines.length && this.products.length) {
      this.customerId = this.presetCustomerId;
      this.dueDate = defaultDueDate();
      this.description = '';
      this.notes = '';
      this.lines = orderLinesFromSaleCart(this.presetCartLines, this.products);
      this.discountMode = 'none';
      this.discountPercent = 0;
      this.discountAmount = 0;
      this.salesChannel = null;
      this.priceType = this.isResellerCustomer
        ? PriceType.MAYORISTA
        : PriceType.LISTA;
    } else {
      this.customerId = this.presetCustomerId;
      this.dueDate = defaultDueDate();
      this.description = '';
      this.notes = '';
      this.lines = [createEmptyLine(ServiceType.IMPRESION_3D)];
      this.discountMode = 'none';
      this.discountPercent = 0;
      this.discountAmount = 0;
      this.salesChannel = null;
      this.priceType = this.isResellerCustomer
        ? PriceType.MAYORISTA
        : PriceType.LISTA;
    }
    this.relinkPrintLinesFromModelado();
    this.syncDesignLineCosts({ preserveCost: this.isEditing });
    this.syncAllDesignPrintLines();
    this.syncAllFdmLines({
      preservePrice: this.isEditing,
      preserveCost: this.isEditing,
    });
    this.syncAllEstampadoLines({
      preservePrice: this.isEditing,
      preserveCost: this.isEditing,
    });
    this.clampDiscountFields();
    this.syncDetailsExpanded();
  }

  /**
   * N4: al reabrir, reatacha la línea 3D siguiente a un modelado con linkPrint.
   */
  private relinkPrintLinesFromModelado(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      ensureLineUiId(line);
      if (
        !line.linkPrint ||
        !isDesignService(line.serviceType) ||
        isGraphicDesignService(line.serviceType)
      ) {
        continue;
      }
      if (this.lines.some((row) => row.linkedModelUiId === line.uiId)) {
        continue;
      }
      const next = this.lines[i + 1];
      if (next && isImpresion3DLine(next.serviceType)) {
        ensureLineUiId(next);
        next.linkedModelUiId = line.uiId;
      }
    }
  }

  private syncAllFdmLines(options?: {
    preservePrice?: boolean;
    preserveCost?: boolean;
  }): void {
    if (!this.generalSettings) return;
    for (const line of this.lines) {
      if (isImpresion3DLine(line.serviceType)) {
        this.syncFdmLine(line, options);
      }
    }
  }

  private syncAllEstampadoLines(options?: {
    preservePrice?: boolean;
    preserveCost?: boolean;
  }): void {
    if (!this.generalSettings) return;
    for (const line of this.lines) {
      if (isEstampadoLine(line.serviceType)) {
        this.syncEstampadoLine(line, options);
      }
    }
  }

  /**
   * B11: al editar, asegurar filas de filamento con color normalizado
   * (Indistinto o el del producto) para que el selector se renderice.
   * No reemplaza el desglose completo (B2); solo hidrata color/filamentos faltantes.
   */
  private hydrateFdmColorSelectors(lines: OrderLineDraft[]): void {
    for (const line of lines) {
      if (!isImpresion3DLine(line.serviceType)) continue;
      const product = this.products.find((p) => p.id === line.productId);
      if (!line.filaments?.length && line.productId?.trim()) {
        applyProductSpecsToFdmLine(line, product, this.products);
      }
      // Resina (catálogo o manual) no usa filamentos; no inventar PLA.
      if (isResinQuoteLine(line, product)) {
        line.filaments = undefined;
        if (!line.productId?.trim() && !line.printProcess) {
          line.printProcess = 'resina';
        }
        continue;
      }
      if (!line.productId?.trim() && !line.printProcess) {
        line.printProcess = 'fdm';
      }
      if (line.filaments?.length) {
        line.filaments = normalizeFdmFilaments(line.filaments);
      } else {
        this.quoteFilaments(line);
      }
    }
  }

  /**
   * B3: normalizar desglose de estampado al abrir; si falta (catálogo),
   * tomar prints/press/supplies del producto antes de costear.
   */
  private hydrateEstampadoQuoteLines(lines: OrderLineDraft[]): void {
    for (const line of lines) {
      if (!isEstampadoLine(line.serviceType)) continue;
      hydrateEstampadoQuoteSpecs(
        line,
        this.products.find((p) => p.id === line.productId),
        this.impresos,
      );
    }
  }

  private syncFdmLine(
    line: OrderLineDraft,
    options?: { preservePrice?: boolean; preserveCost?: boolean },
  ): void {
    if (!this.generalSettings || !this.profitMargins) return;

    const product = this.productForLine(line);
    const isResin = this.isResinProductLine(line);
    const resinType =
      product && 'resinType' in product && product.resinType
        ? product.resinType
        : line.resinType;
    const resinConfigured = isResin && isResinQuoteConfigured({
      ...line,
      resinType,
      printProcess: isResin ? 'resina' : line.printProcess,
    });
    const configured =
      (!isResin && isFdmQuoteConfigured(line)) || resinConfigured;

    // Costear; precio/costo se preservan si son manual/snapshot o al reabrir.
    if (configured) {
      syncFdmQuotePricing(
        line,
        this.generalSettings,
        this.costCalculator,
        impresion3DMargin(this.profitMargins),
        {
          ...options,
          preservePrice: options?.preservePrice || !!line.unitPriceManual,
          preserveCost: options?.preserveCost,
          productType: isResin
            ? ProductType.RESINA
            : product?.type === ProductType.FDM ||
                product?.type === ProductType.COMBO
              ? product.type
              : ProductType.FDM,
          // N1: marca solo para resina de catálogo; FDM/manual por promedio.
          brand:
            isResin && product && 'brand' in product
              ? product.brand
              : undefined,
          resinType: isResin ? resinType : undefined,
          washMinutes: isResin
            ? resolveOrderQuoteWashMinutes(line, product)
            : undefined,
          cureMinutes: isResin
            ? resolveOrderQuoteCureMinutes(line, product)
            : undefined,
        },
      );
      return;
    }

    const keepCost =
      options?.preserveCost &&
      line.unitCost != null &&
      Number.isFinite(Number(line.unitCost));
    const keepPrice = options?.preservePrice || !!line.unitPriceManual;
    if (!keepCost) {
      // Catálogo sin specs configurables en el form: usar costo del producto.
      if (product && Number(product.cost) > 0) {
        line.unitCost = product.cost;
      } else if (!keepPrice) {
        line.unitCost = 0;
      }
    }
    if (!keepPrice) {
      if (product && Number(product.price) > 0) {
        line.unitPrice = product.price;
      } else {
        line.unitPrice = 0;
      }
    }
  }

  private syncEstampadoLine(
    line: OrderLineDraft,
    options?: { preservePrice?: boolean; preserveCost?: boolean },
  ): void {
    if (!this.generalSettings || !this.profitMargins) return;

    if (isEstampadoQuoteConfigured(line)) {
      syncEstampadoQuotePricing(
        line,
        this.generalSettings,
        this.costCalculator,
        estampadoMargin(this.profitMargins),
        {
          ...options,
          preservePrice: options?.preservePrice || !!line.unitPriceManual,
          preserveCost: options?.preserveCost,
          // Misma fuente que el desglose de la UI (evita unitCost 0 por store vacío).
          supplies: this.supplies,
          impresos: this.impresos,
        },
      );
      return;
    }

    const keepCost =
      options?.preserveCost &&
      line.unitCost != null &&
      Number.isFinite(Number(line.unitCost));
    const keepPrice = options?.preservePrice || !!line.unitPriceManual;
    if (!keepCost) {
      const product = this.productForLine(line);
      if (product && Number(product.cost) > 0) {
        line.unitCost = product.cost;
      } else if (!keepPrice) {
        line.unitCost = 0;
      }
    }
    if (!keepPrice) {
      const product = this.productForLine(line);
      if (product && Number(product.price) > 0) {
        line.unitPrice = product.price;
      } else {
        line.unitPrice = 0;
      }
    }
  }

  private applyGeneralSettings(settings: GeneralSettings): void {
    this.generalSettings = settings;
    this.profitMargins = normalizeProfitMargins(settings.profitMargins);
    this.wholesaleDiscount = normalizeWholesaleDiscount(
      settings.wholesaleDiscount,
    );
  }

  /** Costo de diseño/modelado: horas × tarifa. Precio fijo → 0. */
  private designServiceCost(line: OrderLineDraft): number {
    if (this.chargeModeFor(line) === 'fixed') return 0;
    const hours = Math.max(0, Number(line.budgetedHours) || 0);
    return Math.round(this.serviceRate(line) * hours);
  }

  private applyDesignBudget(line: OrderLineDraft): void {
    if (!this.profitMargins) return;
    const hours = Math.max(0, Number(line.budgetedHours) || 0);
    line.budgetedHours = hours;
    const cost = this.designServiceCost(line);
    line.unitCost = cost;
    const price = priceFromCostAndMargin(cost, this.designMarginFor(line));
    line.unitPrice = price;
    line.designUnitPrice = price;
    this.syncDesignPrintLine(line);
  }

  private syncDesignLineCosts(options?: { preserveCost?: boolean }): void {
    for (const line of this.lines) {
      if (!isDesignService(line.serviceType)) continue;
      line.budgetedHours ??= 0;

      // Vacío + horas: sugerir desde tarifa. Nunca inventar costo = precio ÷ margen.
      if (
        (line.unitPrice ?? 0) <= 0 &&
        (line.unitCost ?? 0) <= 0 &&
        this.chargeModeFor(line) === 'hours' &&
        (line.budgetedHours ?? 0) > 0 &&
        this.profitMargins
      ) {
        this.applyDesignBudget(line);
        continue;
      }

      // Al reabrir: conservar snapshot de unitCost si ya vino de la API.
      const keepCost =
        options?.preserveCost &&
        line.unitCost != null &&
        Number.isFinite(Number(line.unitCost));
      if (!keepCost) {
        line.unitCost = this.designServiceCost(line);
      }

      if (line.includesPrint) {
        if (line.designUnitPrice == null && line.unitPrice > 0) {
          line.designUnitPrice = Math.max(
            line.unitPrice - (line.printUnitPrice ?? 0),
            0,
          );
        }
        continue;
      }

      if (line.unitPrice > 0 || line.unitPriceManual) {
        line.designUnitPrice = line.unitPrice;
      } else if ((line.unitCost ?? 0) > 0 && this.profitMargins) {
        line.unitPrice = priceFromCostAndMargin(
          line.unitCost!,
          this.designMarginFor(line),
        );
        line.designUnitPrice = line.unitPrice;
      } else {
        line.unitPrice = 0;
        line.designUnitPrice = 0;
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
