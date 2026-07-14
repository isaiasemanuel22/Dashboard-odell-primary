import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  CreateCustomerPayload,
  Customer,
  UpdateCustomerPayload,
} from '../../core/models';
import { CustomerCatalogService } from '../../core/services/customer-catalog.service';
import { CustomersService } from '../../core/services/customers.service';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../utils/api-error';
import { CustomerFormComponent } from '../../pages/customers/customer-form/customer-form.component';

export interface CustomerFormDialogData {
  customer: Customer | null;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, CustomerFormComponent],
  template: `
    <app-form-dialog-shell
      [title]="customer ? 'Editar cliente' : 'Nuevo cliente'"
      size="sm"
      (close)="cancel()"
    >
      <app-customer-form
        [customer]="customer"
        [loading]="loading"
        [error]="error"
        (save)="save($event)"
        (cancel)="cancel()"
      />
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFormDialogComponent implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly customerCatalog = inject(CustomerCatalogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<Customer>);
  private readonly data = inject<CustomerFormDialogData>(DIALOG_DATA);

  customer: Customer | null = null;
  loading = false;
  error = '';

  ngOnInit(): void {
    this.customer = this.data.customer;
    this.resetState();
  }

  save(data: CreateCustomerPayload): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const request = this.customer
      ? this.customersService.updateCustomer(
          this.customer.id,
          data as UpdateCustomerPayload,
        )
      : this.customersService.createCustomer(data);

    request.subscribe({
      next: (saved) => {
        this.loading = false;
        this.customerCatalog.upsert(saved);
        this.dialogRef.close(saved);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'Error al guardar el cliente');
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private resetState(): void {
    this.loading = false;
    this.error = '';
    this.cdr.markForCheck();
  }
}
