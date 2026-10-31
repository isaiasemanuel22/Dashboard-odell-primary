import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Customer } from '../../core/models';
import { CustomerCatalogService } from '../../core/services/customer-catalog.service';
import { CustomersService } from '../../core/services/customers.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { removeById, upsertById } from '../../core/utils/replace-in-store';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import {
  DB_DATA_TABLE,
  DbButtonComponent,
  OdlActionEvent,
  OdlColumn,
  OdlFilter,
  OdlRowAction,
} from '@general-components';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  clearCreateQuery,
  shouldOpenCreateFromQuery,
} from '../../shared/utils/create-from-query.util';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [DbButtonComponent, ...DB_DATA_TABLE],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersComponent implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly customerCatalog = inject(CustomerCatalogService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  customers: Customer[] = [];
  loading = true;

  readonly kindFilters: OdlFilter<Customer>[] = [
    { id: 'all', label: 'Todos' },
    { id: 'company', label: 'Empresas', predicate: (customer) => Boolean(customer.company?.trim()) },
    { id: 'person', label: 'Particulares', predicate: (customer) => !customer.company?.trim() },
  ];

  readonly actions: OdlRowAction<Customer>[] = [
    { id: 'ver', label: 'Ver ficha' },
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly columns: OdlColumn<Customer>[] = [
    {
      key: 'name',
      header: 'Cliente',
      type: 'avatar',
      sortable: true,
      secondary: (customer) => customer.company?.trim() || 'Particular',
    },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Teléfono', value: (customer) => customer.phone || null },
    { key: 'createdAt', header: 'Cliente desde', type: 'date', sortable: true },
  ];

  ngOnInit(): void {
    this.loadCustomers();
    this.realtime.bindSmartReload(this.destroyRef, 'customers', (event) => {
      this.catalogSync.handleEvent(event);
      this.loadCustomers();
    });

    if (shouldOpenCreateFromQuery(this.route)) {
      this.openCreateCustomer();
      clearCreateQuery(this.router);
    }
  }

  get companyCount(): number {
    return this.customers.filter((customer) => Boolean(customer.company?.trim())).length;
  }

  onAction(event: OdlActionEvent<Customer>): void {
    if (event.actionId === 'ver') this.openCustomer(event.row);
    if (event.actionId === 'editar') this.openEditCustomer(event.row);
    if (event.actionId === 'eliminar') this.deleteCustomer(event.row);
  }

  openCustomer(customer: Customer): void {
    void this.router.navigate(['/clientes', customer.id]);
  }

  loadCustomers(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.customerCatalog.getCustomers().subscribe({
      next: (customers) => {
        this.customers = customers;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  openCreateCustomer(): void {
    this.formDialogs.openCustomer().subscribe((saved) => {
      if (saved) this.onCustomerSaved(saved);
    });
  }

  openEditCustomer(customer: Customer): void {
    this.formDialogs.openCustomer(customer).subscribe((saved) => {
      if (saved) this.onCustomerSaved(saved);
    });
  }

  onCustomerSaved(saved: Customer): void {
    this.customers = upsertById(this.customers, saved);
    this.cdr.markForCheck();
  }

  deleteCustomer(customer: Customer): void {
    this.formDialogs
      .openConfirm({
        title: 'Eliminar cliente',
        message: `¿Eliminar a "${customer.name}"?`,
        confirmLabel: 'Eliminar',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const previous = this.customers;
        this.customers = removeById(this.customers, customer.id);
        this.cdr.markForCheck();

        this.customersService.deleteCustomer(customer.id).subscribe({
          next: () => this.customerCatalog.remove(customer.id),
          error: (err) => {
            this.customers = previous;
            this.cdr.markForCheck();
            this.formDialogs
              .openConfirm({
                title: 'No se pudo eliminar',
                message: extractApiErrorMessage(err, 'No se pudo eliminar el cliente'),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }
}
