import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateOrderPayload,
  CreateQuotePayload,
  Customer,
  GeneralSettings,
  ImpresoWithCost,
  Order,
  OrderLineDraft,
  PaperType,
  Product,
  Quote,
  ServiceType,
} from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import { ImpresosService } from '../../../core/services/impresos.service';
import { ProductCostCalculationService } from '../../../core/services/product-cost-calculation.service';
import {
  DbFieldsetComponent,
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
  DEFAULT_PROFIT_MARGINS,
  normalizeProfitMargins,
  costFromPriceAndMargin,
  priceFromCostAndMargin,
  getMarginForService,
} from '../../../shared/utils/pricing.util';
import { SERVICE_TYPE_LABELS } from '../../../shared/constants/labels';
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
import { lineFromQuoteItem } from '../../../shared/utils/quote.helpers';

export type OrderFormVariant = 'order' | 'quote';

export type OrderFormSavePayload = CreateOrderPayload | CreateQuotePayload;

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbFormGridComponent,
    DbFormGridFullComponent,
    DbSelectComponent,
    DbInputComponent,
    DbFieldsetComponent,
    DbTextareaComponent,
    DbRichTextEditorComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
    DbCheckboxComponent,
    CurrencyArsPipe,
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
  profitMargins = DEFAULT_PROFIT_MARGINS;
  generalSettings: GeneralSettings | null = null;
  impresos: ImpresoWithCost[] = [];

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

  get linesHint(): string {
    if (this.isQuoteForm) {
      return 'Armá el presupuesto con los servicios y productos a cotizar.';
    }
    return 'Podés mezclar impresión 3D, diseño gráfico, modelado y estampado en el mismo pedido. Cada línea genera tareas individuales en la cola de trabajo.';
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
      label: c.company ? `${c.name} (${c.company})` : c.name,
    }));
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

  get totalCost(): number {
    return calculateOrderLinesCost(
      this.billableLines,
      this.products,
      this.profitMargins,
    );
  }

  get profit(): number {
    return this.total - this.totalCost;
  }

  designMarginFor(line: OrderLineDraft): number {
    return getMarginForService(line.serviceType, this.profitMargins);
  }

  ngOnInit(): void {
    this.settingsService.getGeneralSettings().subscribe((settings) => {
      this.generalSettings = settings;
      this.profitMargins = normalizeProfitMargins(settings.profitMargins);
      this.syncDesignLineCosts();
      this.syncAllDesignPrintLines();
      this.syncAllFdmLines({ preservePrice: this.isEditing });
    });
    this.impresosService.getImpresos().subscribe((items) => {
      this.impresos = items;
    });
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

    if (isImpresion3DLine(line.serviceType)) {
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
    line.unitCost = isDesignService(line.serviceType) ? 0 : undefined;
    line.unitPrice = 0;
    line.budgetedHours = isDesignService(line.serviceType) ? 3 : undefined;
    line.printTimeHours = undefined;
    line.grams = undefined;
    line.filamentType = undefined;
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
    if (isDesignService(line.serviceType)) {
      this.applyDesignBudget(line);
    }
  }

  onProductChange(line: OrderLineDraft): void {
    const product = line.productId
      ? this.products.find((p) => p.id === line.productId)
      : undefined;

    if (!product) {
      line.unitPrice = 0;
      line.unitCost = undefined;
      return;
    }

    applyProductSpecsToFdmLine(line, product);
    if (isImpresion3DLine(line.serviceType)) {
      this.syncFdmLine(line, { preservePrice: false });
      return;
    }

    line.unitPrice = product.price;
  }

  onFdmQuoteChange(line: OrderLineDraft): void {
    this.syncFdmLine(line);
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
    if (line.productId) {
      return 'Costo tomado del catálogo de productos.';
    }
    return 'Presupuesto calculado según configuración de costos y margen de Impresión 3D.';
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

  onBudgetedHoursChange(line: OrderLineDraft, raw: number | string): void {
    line.budgetedHours = Math.max(0, Number(raw) || 0);
    this.applyDesignBudget(line);
  }

  onDesignUnitCostChange(line: OrderLineDraft, raw: number | string): void {
    const cost = Number(raw) || 0;
    line.unitCost = cost;
    const designPrice = priceFromCostAndMargin(cost, this.designMarginFor(line));
    line.designUnitPrice = designPrice;
    this.syncDesignPrintLine(line);
  }

  onDesignUnitPriceChange(line: OrderLineDraft, raw: number | string): void {
    const price = Number(raw) || 0;
    line.designUnitPrice = price;
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

  onSubmit(): void {
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
      this.save.emit(shared satisfies CreateQuotePayload);
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
    if (this.isQuoteForm) return true;
    return (
      !!this.customerId.trim() &&
      !!this.dueDate &&
      !this.dueDateError &&
      plainTextFromHtml(this.description).length <= this.descriptionMaxLength
    );
  }

  private resetForm(): void {
    if (this.isQuoteForm && this.quote) {
      this.customerId = this.quote.customerId ?? '';
      this.lines = this.quote.items.map((item) => lineFromQuoteItem(item));
      this.discountMode = discountModeFromValues(
        this.quote.discountPercent,
        this.quote.discountAmount,
      );
      this.discountPercent = this.quote.discountPercent ?? 0;
      this.discountAmount = this.quote.discountAmount ?? 0;
    } else if (this.presetQuote) {
      this.customerId = this.presetQuote.customerId ?? '';
      this.dueDate = defaultDueDate();
      this.description = '';
      this.notes = '';
      this.lines = this.presetQuote.items.map((item) => lineFromQuoteItem(item));
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
  }

  private syncAllFdmLines(options?: { preservePrice?: boolean }): void {
    if (!this.generalSettings) return;
    for (const line of this.lines) {
      if (isImpresion3DLine(line.serviceType)) {
        this.syncFdmLine(line, options);
      }
    }
  }

  private syncFdmLine(
    line: OrderLineDraft,
    options?: { preservePrice?: boolean },
  ): void {
    if (!this.generalSettings) return;

    const product = this.productForLine(line);
    if (product && line.productId) {
      line.unitCost = resolveProductUnitCost(product, this.products);
      if (!options?.preservePrice) {
        line.unitPrice = product.price;
      }
      return;
    }

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

    if (product) {
      line.unitCost = resolveProductUnitCost(product, this.products);
      if (!options?.preservePrice) {
        line.unitPrice = product.price;
      }
    }
  }

  private applyDesignBudget(line: OrderLineDraft): void {
    const hours = line.budgetedHours ?? 3;
    line.budgetedHours = hours;
    const cost = Math.round(this.serviceRate(line) * hours);
    line.unitCost = cost;
    const price = priceFromCostAndMargin(cost, this.designMarginFor(line));
    line.unitPrice = price;
    line.designUnitPrice = price;
    this.syncDesignPrintLine(line);
  }

  private syncDesignLineCosts(): void {
    for (const line of this.lines) {
      if (!isDesignService(line.serviceType)) continue;
      if ((line.unitPrice ?? 0) <= 0 && (line.unitCost ?? 0) <= 0) {
        line.budgetedHours ??= 3;
        this.applyDesignBudget(line);
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
