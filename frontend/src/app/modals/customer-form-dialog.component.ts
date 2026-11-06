import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { filter } from 'rxjs';
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
import { FormDialogService } from './form-dialog.service';

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
          [dockSecondaryFixed]="true"
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
  private readonly formDialogs = inject(FormDialogService);
  private readonly breakpoint = inject(BreakpointService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(DialogRef<Customer>);
  private readonly data = inject<CustomerFormDialogData>(DIALOG_DATA);

  @ViewChild('customerForm') private customerForm?: CustomerFormComponent;

  readonly isMobile = this.breakpoint.isMobile;

  customer: Customer | null = null;
  loading = false;
  error = '';
  savedNotice = '';
  private closing = false;
  private confirmingDiscard = false;

  get mobileDockActions(): MobileDockAction[] {
    const form = this.customerForm;
    return [
      {
        id: 'cancel',
        label: 'Cancelar',
        kind: 'secondary',
        disabled: this.loading,
      },
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
    this.dialogRef.disableClose = true;
    this.dialogRef.backdropClick
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cancel());
    this.dialogRef.keydownEvents
      .pipe(
        filter((event) => event.key === 'Escape'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        event.preventDefault();
        this.cancel();
      });
  }

  onMobileDockAction(id: string): void {
    if (id === 'cancel') {
      this.cancel();
      return;
    }
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
    if (this.closing || this.confirmingDiscard) return;

    const discard = (): void => {
      this.closing = true;
      this.dialogRef.close();
    };

    if (!this.customerForm?.hasUnsavedChanges()) {
      discard();
      return;
    }

    this.confirmingDiscard = true;
    this.formDialogs
      .openConfirm({
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar. ¿Descartar el cliente y cerrar?',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        this.confirmingDiscard = false;
        if (confirmed) discard();
      });
  }

  private resetState(): void {
    this.loading = false;
    this.error = '';
    this.cdr.markForCheck();
  }
}
