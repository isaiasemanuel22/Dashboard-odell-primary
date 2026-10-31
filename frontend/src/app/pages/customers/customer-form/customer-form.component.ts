import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Customer } from '../../../core/models';
import {
  DbFormComponent,
  DbFormErrorComponent,
  DbFormFooterComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbButtonComponent,
} from '@general-components';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbFormGridComponent,
    DbInputComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
  ],
  templateUrl: './customer-form.component.html',
  styleUrl: './customer-form.component.scss',
})
export class CustomerFormComponent implements OnChanges {
  @Input() customer: Customer | null = null;
  @Input() loading = false;
  @Input() error = '';
  @Output() save = new EventEmitter<{
    name: string;
    email: string;
    phone: string;
    company?: string;
  }>();
  @Output() cancel = new EventEmitter<void>();

  name = '';
  email = '';
  phone = '';
  company = '';
  emailError = '';
  phoneError = '';

  get isEditing(): boolean {
    return this.customer !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['customer']) {
      this.resetForm();
    }
  }

  onSubmit(): void {
    const email = this.email.trim();
    const phone = this.phone.trim();
    this.emailError = isValidCustomerEmail(email) ? '' : 'El email no es válido';
    this.phoneError = isValidCustomerPhone(phone)
      ? ''
      : 'El teléfono tiene que tener números, sin letras';
    if (this.emailError || this.phoneError) return;

    this.save.emit({
      name: this.name.trim(),
      email,
      phone,
      company: this.company.trim() || undefined,
    });
  }

  private resetForm(): void {
    if (this.customer) {
      this.name = this.customer.name;
      this.email = this.customer.email;
      this.phone = this.customer.phone;
      this.company = this.customer.company ?? '';
    } else {
      this.name = '';
      this.email = '';
      this.phone = '';
      this.company = '';
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
