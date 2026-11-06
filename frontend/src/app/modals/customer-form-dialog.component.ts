import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  CreateCustomerPayload,
  Customer,
  UpdateCustomerPayload,
} from '../core/models';
import { BreakpointService } from '../core/services/breakpoint.service';
import { CustomerCatalogService } from '../core/services/customer-catalog.service';
import { CustomersService } from '../core/services/customers.service';
import { FormDialogShellComponent } from './form-dialog-shell/form-dialog-shell.component';
import { MobileFormShellComponent } from '../components/mobile-form-shell/mobile-form-shell.component';
import type { MobileDockAction } from '../components/mobile-dock/mobile-dock.component';
import { extractApiErrorMessage } from '../shared/utils/api-error';
import { CustomerFormComponent } from '../pages/customers/customer-form/customer-form.component';

export interface CustomerFormDialogData {
  customer: Customer | null;
}

@Component({
  standalone: true,
  imports: [
    FormDialogShellComponent,
    MobileFormShellComponent,
    CustomerFormComponent,
  ],
  template: `
    <app-form-dialog-shell
      [title]="customer ? 'Editar cliente' : 'Nuevo cliente'"
      [subtitle]="isMobile() ? '' : 'Los campos con * son obligatorios'"
      size="md"
      (close)="cancel()"
    >
      @if (isMobile()) {
        <db-mobile-form-shell
          [title]="customer ? 'Editar cliente' : 'Nuevo cliente'"
          [dockActions]="mobileDockActions"
          (close)="cancel()"
          (dockAction)="onMobileDockAction($event)"
        >
          @if (savedNotice) {
            <p class="customer-saved" role="status">{{ savedNotice }}</p>
          }
          <app-customer-form
            #customerForm
            [customer]="customer"
            [loading]="loading"
            [error]="error"
            [hideFooter]="true"
            (save)="save($event)"
            (cancel)="cancel()"
          />
        </db-mobile-form-shell>
      } @else {
        @if (savedNotice) {
          <p class="customer-saved" role="status">{{ savedNotice }}</p>
        }
        <app-customer-form
          [customer]="customer"
          [loading]="loading"
          [error]="error"
          (save)="save($event)"
          (cancel)="cancel()"
        />
      }
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .customer-saved {
      margin: 0 0 0.75rem;
      color: #166534;
      font-weight: 600;
    }
  `,
})
export class CustomerFormDialogComponent implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly customerCatalog = inject(CustomerCatalogService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<Customer>);
  private readonly data = inject<CustomerFormDialogData>(DIALOG_DATA);

  @ViewChild('customerForm') private customerForm?: CustomerFormComponent;

  readonly isMobile = this.breakpoint.isMobile;

  customer: Customer | null = null;
  loading = false;
  error = '';
  savedNotice = '';

  get mobileDockActions(): MobileDockAction[] {
    const form = this.customerForm;
    return [
      {
        id: 'save',
        label: this.loading
          ? 'Guardando...'
          : this.customer
            ? 'Guardar'
            : 'Crear cliente',
        kind: 'primary',
        disabled: this.loading || !(form?.canSubmit ?? false),
        loading: this.loading,
      },
    ];
  }

  ngOnInit(): void {
    this.customer = this.data.customer;
    this.resetState();
  }

  onMobileDockAction(id: string): void {
    if (id === 'save') {
      this.customerForm?.onSubmit();
    }
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
        if (!this.customer) {
          this.savedNotice = `Cliente ${saved.name} creado`;
          this.cdr.markForCheck();
          setTimeout(() => this.dialogRef.close(saved), 700);
          return;
        }
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
