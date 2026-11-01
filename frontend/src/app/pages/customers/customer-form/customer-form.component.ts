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
  CreateCustomerPayload,
  Customer,
  CustomerSource,
  CustomerType,
} from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import {
  DbFormComponent,
  DbFormErrorComponent,
  DbFormFooterComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
  DbButtonComponent,
  DbSegmentedControlComponent,
  DbSegmentOption,
} from '@general-components';
import {
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_TYPE_LABELS,
} from '../../../shared/utils/v1-labels.util';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbFormGridComponent,
    DbInputComponent,
    DbSelectComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
    DbSegmentedControlComponent,
  ],
  templateUrl: './customer-form.component.html',
  styleUrl: './customer-form.component.scss',
})
export class CustomerFormComponent implements OnInit, OnChanges {
  private readonly settingsService = inject(SettingsService);

  @Input() customer: Customer | null = null;
  @Input() loading = false;
  @Input() error = '';
  @Output() save = new EventEmitter<CreateCustomerPayload>();
  @Output() cancel = new EventEmitter<void>();

  readonly CustomerType = CustomerType;

  readonly typeOptions: DbSegmentOption<CustomerType>[] = (
    Object.values(CustomerType) as CustomerType[]
  ).map((value) => ({
    value,
    label: CUSTOMER_TYPE_LABELS[value],
  }));

  readonly sourceOptions: DbSelectOption<CustomerSource>[] = (
    Object.values(CustomerSource) as CustomerSource[]
  ).map((value) => ({
    value,
    label: CUSTOMER_SOURCE_LABELS[value],
  }));

  name = '';
  email = '';
  phone = '';
  company = '';
  type: CustomerType = CustomerType.PARTICULAR;
  wholesaleMinimum: number | null = null;
  taxId = '';
  source: CustomerSource | '' = '';
  emailError = '';
  phoneError = '';
  wholesaleDiscountPercent = 0;

  get isEditing(): boolean {
    return this.customer !== null;
  }

  get isRevendedor(): boolean {
    return this.type === CustomerType.REVENDEDOR;
  }

  get wholesaleDiscountLabel(): string {
    return `−${this.wholesaleDiscountPercent}% sobre lista`;
  }

  ngOnInit(): void {
    this.settingsService.getGeneralSettings().subscribe({
      next: (settings) => {
        this.wholesaleDiscountPercent =
          settings.wholesaleDiscount?.percent ?? 0;
      },
      error: () => {
        this.wholesaleDiscountPercent = 0;
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['customer']) {
      this.resetForm();
    }
  }

  onTypeChange(type: CustomerType): void {
    this.type = type;
  }

  onSubmit(): void {
    const email = this.email.trim();
    const phone = this.phone.trim();
    this.emailError = isValidCustomerEmail(email) ? '' : 'El email no es válido';
    this.phoneError = isValidCustomerPhone(phone)
      ? ''
      : 'El teléfono tiene que tener números, sin letras';
    if (this.emailError || this.phoneError) return;

    const payload: CreateCustomerPayload = {
      name: this.name.trim(),
      email,
      phone,
      company: this.company.trim() || undefined,
      type: this.type,
      source: this.source || undefined,
    };

    if (this.isRevendedor) {
      if (this.wholesaleMinimum !== null && this.wholesaleMinimum !== undefined) {
        const min = Number(this.wholesaleMinimum);
        if (!Number.isNaN(min) && min >= 0) {
          payload.wholesaleMinimum = min;
        }
      }
      const taxId = this.taxId.trim();
      if (taxId) {
        payload.taxId = taxId;
      }
    }

    this.save.emit(payload);
  }

  private resetForm(): void {
    if (this.customer) {
      this.name = this.customer.name;
      this.email = this.customer.email;
      this.phone = this.customer.phone;
      this.company = this.customer.company ?? '';
      this.type = this.customer.type ?? CustomerType.PARTICULAR;
      this.wholesaleMinimum =
        this.customer.wholesaleMinimum !== undefined
          ? this.customer.wholesaleMinimum
          : null;
      this.taxId = this.customer.taxId ?? '';
      this.source = this.customer.source ?? '';
    } else {
      this.name = '';
      this.email = '';
      this.phone = '';
      this.company = '';
      this.type = CustomerType.PARTICULAR;
      this.wholesaleMinimum = null;
      this.taxId = '';
      this.source = '';
    }
    this.emailError = '';
    this.phoneError = '';
  }
}

export function isValidCustomerEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidCustomerPhone(phone: string): boolean {
  if (/[a-zA-Z]/.test(phone)) return false;
  return phone.replace(/\D/g, '').length >= 6;
}
