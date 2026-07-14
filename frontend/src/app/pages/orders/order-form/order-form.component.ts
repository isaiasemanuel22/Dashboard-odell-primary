import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
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
  DbButtonComponent,
} from '@general-components';
import {
  buildOrderItems,
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
import { productComponentSelectLabel } from '../../../shared/utils/product.helpers';
import { SERVICE_TYPE_LABELS } from '../../../shared/constants/labels';
import { CurrencyArsPipe } from '../../../shared/pipes/labels.pipe';

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
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
    CurrencyArsPipe,
  ],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.scss',
})
export class OrderFormComponent implements OnChanges {
  @Input() order: Order | null = null;
  @Input() customers: Customer[] = [];
  @Input() products: Product[] = [];
  @Input() loading = false;
  @Input() error = '';
  @Output() save = new EventEmitter<{
    customerId: string;
    services: ServiceType[];
    items: ReturnType<typeof buildOrderItems>;
    status: OrderStatus;
    notes?: string;
    description?: string;
    dueDate: string;
  }>();
  @Output() cancel = new EventEmitter<void>();

  customerId = '';
  selectedServices: ServiceType[] = [ServiceType.IMPRESION_3D];
  status: OrderStatus = OrderStatus.PENDIENTE;
  dueDate = defaultDueDate();
  description = '';
  notes = '';
  lines: OrderLineDraft[] = [createEmptyLine(ServiceType.IMPRESION_3D)];

  readonly serviceTypeOptions = serviceTypeOptions();
  readonly orderStatusOptions = orderStatusOptions();
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

  get total(): number {
    return calculateOrderTotal(this.lines.filter((line) => isLineValid(line)));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order'] || changes['products']) {
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
    line.unitPrice = 0;
  }

  onProductChange(line: OrderLineDraft): void {
    const product = this.products.find((p) => p.id === line.productId);
    if (product) {
      line.unitPrice = product.price;
    }
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
    this.save.emit({
      customerId: this.customerId,
      services: [...this.selectedServices],
      items: buildOrderItems(validLines, this.products),
      status: this.status,
      description: this.description.trim() || undefined,
      notes: this.notes.trim() || undefined,
      dueDate: toOrderDueDate(this.dueDate),
    });
  }

  canSubmit(): boolean {
    return (
      !!this.customerId &&
      !!this.dueDate &&
      this.selectedServices.length > 0 &&
      this.description.length <= this.descriptionMaxLength &&
      this.lines.some((line) => isLineValid(line))
    );
  }

  private resetForm(): void {
    if (this.order) {
      this.customerId = this.order.customerId;
      this.selectedServices = [...this.order.services];
      this.status = this.order.status;
      this.dueDate = toDateInputValue(this.order.dueDate);
      this.description = this.order.description ?? '';
      this.notes = this.order.notes ?? '';
      this.lines = this.order.items.map((item) => lineFromOrderItem(item));
    } else {
      this.customerId = '';
      this.selectedServices = [ServiceType.IMPRESION_3D];
      this.status = OrderStatus.PENDIENTE;
      this.dueDate = defaultDueDate();
      this.description = '';
      this.notes = '';
      this.lines = [createEmptyLine(ServiceType.IMPRESION_3D)];
    }
  }
}
