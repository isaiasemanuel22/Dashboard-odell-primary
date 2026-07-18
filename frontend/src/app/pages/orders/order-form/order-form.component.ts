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
  Customer,
  Order,
  OrderLineDraft,
  OrderStatus,
  Product,
  ServiceType,
} from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import {
  DbCheckboxComponent,
  DbCheckboxGroupComponent,
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
} from '@general-components';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import {
  buildOrderItems,
  calculateOrderDiscount,
  calculateOrderSubtotal,
  isLineBillable,
  calculateOrderTotal,
  createEmptyLine,
  defaultDueDate,
  isDesignService,
  isLineValid,
  lineFromOrderItem,
  orderStatusOptions,
  ORDER_DESCRIPTION_MAX_LENGTH,
  productMatchesServiceType,
  serviceTypeOptions,
  toDateInputValue,
  toOrderDueDate,
} from '../../../shared/utils/order.helpers';
import {
  productComponentSelectLabel,
  calculateOrderLinesCost,
} from '../../../shared/utils/product.helpers';
import {
  DEFAULT_PROFIT_MARGINS,
  normalizeProfitMargins,
  costFromPriceAndMargin,
  priceFromCostAndMargin,
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
    DbCheckboxGroupComponent,
    DbCheckboxComponent,
    DbTextareaComponent,
    DbRichTextEditorComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
    CurrencyArsPipe,
  ],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.scss',
})
export class OrderFormComponent implements OnChanges, OnInit {
  private readonly formDialogs = inject(FormDialogService);
  private readonly mediaUpload = inject(MediaUploadService);
  private readonly settingsService = inject(SettingsService);

  readonly uploadDescriptionImage: DbFileUploadFn = (file) =>
    firstValueFrom(this.mediaUpload.uploadProductImage(file));

  @Input() order: Order | null = null;
  @Input() customers: Customer[] = [];
  @Input() products: Product[] = [];
  @Input() presetCustomerId = '';
  @Input() loading = false;
  @Input() error = '';
  @Output() save = new EventEmitter<{
    customerId?: string;
    services: ServiceType[];
    items: ReturnType<typeof buildOrderItems>;
    status: OrderStatus;
    notes?: string;
    description?: string;
    dueDate: string;
    discountPercent?: number;
    discountAmount?: number;
  }>();
  @Output() cancel = new EventEmitter<void>();
  @Output() customerCreated = new EventEmitter<Customer>();

  customerId = '';
  selectedServices: ServiceType[] = [ServiceType.IMPRESION_3D];
  status: OrderStatus = OrderStatus.PENDIENTE;
  dueDate = defaultDueDate();
  description = '';
  notes = '';
  lines: OrderLineDraft[] = [createEmptyLine(ServiceType.IMPRESION_3D)];
  discountMode: DiscountMode = 'none';
  discountPercent = 0;
  discountAmount = 0;
  profitMargins = DEFAULT_PROFIT_MARGINS;

  readonly serviceTypeOptions = serviceTypeOptions();
  readonly orderStatusOptions = orderStatusOptions();
  readonly discountModeOptions: DbSelectOption[] = [
    { value: 'none', label: 'Sin descuento' },
    { value: 'percent', label: 'Porcentaje (%)' },
    { value: 'amount', label: 'Monto fijo ($)' },
  ];
  readonly descriptionMaxLength = ORDER_DESCRIPTION_MAX_LENGTH;
  readonly ServiceType = ServiceType;
  readonly isDesignService = isDesignService;

  get isEditing(): boolean {
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

  get designMargin(): number {
    return this.profitMargins.diseno;
  }

  ngOnInit(): void {
    this.settingsService.getGeneralSettings().subscribe((settings) => {
      this.profitMargins = normalizeProfitMargins(settings.profitMargins);
      this.syncDesignLineCosts();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order'] || changes['products'] || changes['presetCustomerId']) {
      this.resetForm();
    }
  }

  serviceLabel(serviceType: ServiceType): string {
    return SERVICE_TYPE_LABELS[serviceType];
  }

  isServiceSelected(serviceType: ServiceType): boolean {
    return this.selectedServices.includes(serviceType);
  }

  onServiceCheck(serviceType: ServiceType, checked: boolean): void {
    if (checked) {
      if (!this.selectedServices.includes(serviceType)) {
        this.selectedServices = [...this.selectedServices, serviceType];
      }
      return;
    }

    this.selectedServices = this.selectedServices.filter((s) => s !== serviceType);
    this.lines = this.lines.filter((line) => line.serviceType !== serviceType);
    if (!this.lines.length && this.selectedServices.length) {
      this.lines = [createEmptyLine(this.selectedServices[0])];
    }
  }

  lineServiceOptions() {
    return this.serviceTypeOptions.filter((option) =>
      this.selectedServices.includes(option.value),
    );
  }

  productOptionsForLine(line: OrderLineDraft) {
    const options = this.products
      .filter((p) => productMatchesServiceType(p, line.serviceType))
      .map((p) => ({
        value: p.id,
        label: productComponentSelectLabel(p),
      }));

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
  }

  onProductChange(line: OrderLineDraft): void {
    const product = this.products.find((p) => p.id === line.productId);
    if (product) {
      line.unitPrice = product.price;
    }
  }

  onDesignUnitCostChange(line: OrderLineDraft, raw: number | string): void {
    const cost = Number(raw) || 0;
    line.unitCost = cost;
    line.unitPrice = priceFromCostAndMargin(cost, this.designMargin);
  }

  onDesignUnitPriceChange(line: OrderLineDraft, raw: number | string): void {
    const price = Number(raw) || 0;
    line.unitPrice = price;
    line.unitCost = costFromPriceAndMargin(price, this.designMargin);
  }

  productUnitCost(line: OrderLineDraft): number {
    const product = this.products.find((p) => p.id === line.productId);
    return product?.cost ?? 0;
  }

  addLine(): void {
    const serviceType = this.selectedServices[0] ?? ServiceType.IMPRESION_3D;
    this.lines = [...this.lines, createEmptyLine(serviceType)];
  }

  removeLine(index: number): void {
    if (this.lines.length === 1) {
      const serviceType = this.selectedServices[0] ?? ServiceType.IMPRESION_3D;
      this.lines = [createEmptyLine(serviceType)];
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
    const payload: {
      customerId?: string;
      services: ServiceType[];
      items: ReturnType<typeof buildOrderItems>;
      status: OrderStatus;
      notes?: string;
      description?: string;
      dueDate: string;
      discountPercent?: number;
      discountAmount?: number;
    } = {
      services: [...this.selectedServices],
      items: buildOrderItems(validLines, this.products),
      status: this.status,
      description: hasRichTextContent(this.description)
        ? sanitizeRichTextHtml(this.description)
        : undefined,
      notes: this.notes.trim() || undefined,
      dueDate: toOrderDueDate(this.dueDate),
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
    };

    if (this.customerId.trim()) {
      payload.customerId = this.customerId.trim();
    }

    this.save.emit(payload);
  }

  openNewCustomer(): void {
    this.formDialogs.openCustomer().subscribe((customer) => {
      if (!customer) return;
      this.customerCreated.emit(customer);
      this.customerId = customer.id;
    });
  }

  canSubmit(): boolean {
    return (
      !!this.dueDate &&
      this.selectedServices.length > 0 &&
      plainTextFromHtml(this.description).length <= this.descriptionMaxLength &&
      this.lines.some((line) => isLineValid(line))
    );
  }

  private resetForm(): void {
    if (this.order) {
      this.customerId = this.order.customerId ?? '';
      this.selectedServices = [...this.order.services];
      this.status = this.order.status;
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
    } else {
      this.customerId = this.presetCustomerId;
      this.selectedServices = [ServiceType.IMPRESION_3D];
      this.status = OrderStatus.PENDIENTE;
      this.dueDate = defaultDueDate();
      this.description = '';
      this.notes = '';
      this.lines = [createEmptyLine(ServiceType.IMPRESION_3D)];
      this.discountMode = 'none';
      this.discountPercent = 0;
      this.discountAmount = 0;
    }
    this.syncDesignLineCosts();
  }

  private syncDesignLineCosts(): void {
    const margin = this.designMargin;
    for (const line of this.lines) {
      if (!isDesignService(line.serviceType)) continue;
      if (line.unitPrice > 0) {
        line.unitCost = costFromPriceAndMargin(line.unitPrice, margin);
      } else if ((line.unitCost ?? 0) > 0) {
        line.unitPrice = priceFromCostAndMargin(line.unitCost!, margin);
      } else {
        line.unitCost = 0;
      }
    }
  }
}
