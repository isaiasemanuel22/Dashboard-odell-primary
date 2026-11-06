import {
  Component,
  EventEmitter,
  HostListener,
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_ERROR_MSG =
  'Revisá el email: falta el dominio (por ejemplo, .com)';
const PHONE_HINT_DEFAULT = 'Con código de área, para WhatsApp';
const PHONE_HINT_READY = 'Listo para WhatsApp';

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
  /** En mobile el pie vive en `db-mobile-form-shell` / dock. */
  @Input() hideFooter = false;
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
  private userEdited = false;

  get isEditing(): boolean {
    return this.customer !== null;
  }

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
        'button, [role="button"], input, select, textarea, .db-seg__btn',
      )
    ) {
      this.userEdited = true;
    }
  }

  get isRevendedor(): boolean {
    return this.type === CustomerType.REVENDEDOR;
  }

  get wholesaleDiscountLabel(): string {
    return `−${this.wholesaleDiscountPercent}% sobre lista`;
  }

  get phoneDigitCount(): number {
    return this.phone.replace(/\D/g, '').length;
  }

  get phoneReadyForWhatsApp(): boolean {
    return this.phoneDigitCount >= 10;
  }

  get phoneHint(): string {
    return this.phoneReadyForWhatsApp ? PHONE_HINT_READY : PHONE_HINT_DEFAULT;
  }

  get submitMissing(): string[] {
    const missing: string[] = [];
    if (!this.name.trim()) missing.push('nombre');
    if (!this.phone.trim()) missing.push('teléfono');
    else if (!isValidCustomerPhone(this.phone.trim())) {
      missing.push('un teléfono válido');
    }
    if (!this.email.trim()) missing.push('email');
    else if (!isValidCustomerEmail(this.email.trim())) {
      missing.push('un email válido');
    }
    return missing;
  }

  get submitMissingLabel(): string {
    const items = this.submitMissing;
    if (!items.length) return '';
    return items.length === 1
      ? `Falta: ${items[0]}`
      : `Faltan: ${items.join(', ')}`;
  }

  get canSubmit(): boolean {
    return !this.loading && this.submitMissing.length === 0;
  }

  /** Vista `$ 50.000` (mismo formateo que currencyArs). El modelo sigue numérico. */
  get wholesaleMinimumDisplay(): string {
    if (this.wholesaleMinimum === null || this.wholesaleMinimum === undefined) {
      return '';
    }
    const amount = Math.round(Number(this.wholesaleMinimum));
    if (!Number.isFinite(amount)) return '';
    return formatCustomerMoney(amount);
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

  onEmailBlur(): void {
    this.emailError = isValidCustomerEmail(this.email.trim())
      ? ''
      : EMAIL_ERROR_MSG;
  }

  onWholesaleMinimumDisplayChange(raw: string): void {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) {
      this.wholesaleMinimum = null;
      return;
    }
    this.wholesaleMinimum = Math.round(Number(digits));
  }

  onSubmit(): void {
    const email = this.email.trim();
    const phone = this.phone.trim();
    this.emailError = isValidCustomerEmail(email) ? '' : EMAIL_ERROR_MSG;
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
        if (!Number.isNaN(min) && min > 0) {
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
      this.email = this.customer.email ?? '';
      this.phone = this.customer.phone;
      this.company = this.customer.company ?? '';
      this.type = this.customer.type ?? CustomerType.PARTICULAR;
      this.wholesaleMinimum =
        this.customer.wholesaleMinimum !== undefined &&
        this.customer.wholesaleMinimum !== null &&
        Number(this.customer.wholesaleMinimum) > 0
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
    this.userEdited = false;
  }
}

export function isValidCustomerEmail(email: string): boolean {
  if (!email.trim()) return true;
  return EMAIL_PATTERN.test(email);
}

export function isValidCustomerPhone(phone: string): boolean {
  if (/[a-zA-Z]/.test(phone)) return false;
  return phone.replace(/\D/g, '').length >= 6;
}

function formatCustomerMoney(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}
