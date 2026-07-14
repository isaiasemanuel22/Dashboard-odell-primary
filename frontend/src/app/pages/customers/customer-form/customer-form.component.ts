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
  DbInputComponent,
  DbButtonComponent,
} from '@general-components';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [
    FormsModule,
    DbFormComponent,
    DbInputComponent,
    DbFormErrorComponent,
    DbFormFooterComponent,
    DbButtonComponent,
  ],
  templateUrl: './customer-form.component.html',
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

  get isEditing(): boolean {
    return this.customer !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['customer']) {
      this.resetForm();
    }
  }

  onSubmit(): void {
    this.save.emit({
      name: this.name.trim(),
      email: this.email.trim(),
      phone: this.phone.trim(),
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
  }
}
