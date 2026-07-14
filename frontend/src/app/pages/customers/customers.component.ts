import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Customer } from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { CustomerCatalogService } from '../../core/services/customer-catalog.service';
import { CustomersService } from '../../core/services/customers.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { removeById, upsertById } from '../../core/utils/replace-in-store';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import {
  CustomerCardComponent,
  DbListToolbarComponent,
  DbStateMessageComponent,
  DbButtonComponent,
} from '@general-components';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import {
  clearCreateQuery,
  shouldOpenCreateFromQuery,
} from '../../shared/utils/create-from-query.util';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    FormsModule,
    CustomerCardComponent,
    DbStateMessageComponent,
    DbListToolbarComponent,
    DbButtonComponent,
  ],
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
  search = '';

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

  get filteredCustomers(): Customer[] {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.customers;
    return this.customers.filter((customer) => {
      const haystack = [
        customer.name,
        customer.email,
        customer.phone,
        customer.company ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
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
    if (!confirm(`¿Eliminar a "${customer.name}"?`)) return;

    const previous = this.customers;
    this.customers = removeById(this.customers, customer.id);
    this.cdr.markForCheck();

    this.customersService.deleteCustomer(customer.id).subscribe({
      next: () => this.customerCatalog.remove(customer.id),
      error: (err) => {
        this.customers = previous;
        this.cdr.markForCheck();
        alert(
          extractApiErrorMessage(err, 'No se pudo eliminar el cliente'),
        );
      },
    });
  }
}
