import {
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Customer, Order } from '../../../core/models';
import { CustomersService } from '../../../core/services/customers.service';
import { OrdersService } from '../../../core/services/orders.service';
import {
  DbButtonComponent,
  DbStateMessageComponent,
  OrdersTableComponent,
} from '@general-components';
import { FormDialogService } from '../../../shared/form-dialogs/public-api';
import { extractApiErrorMessage } from '../../../shared/utils/api-error';
import {
  isActiveOrder,
  isFinishedOrder,
} from '../../../shared/utils/order.helpers';
import {
  CurrencyArsPipe,
  DateShortPipe,
} from '../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    RouterLink,
    DateShortPipe,
    CurrencyArsPipe,
    DbButtonComponent,
    DbStateMessageComponent,
    OrdersTableComponent,
  ],
  templateUrl: './customer-detail.component.html',
  styleUrl: './customer-detail.component.scss',
})
export class CustomerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customersService = inject(CustomersService);
  private readonly ordersService = inject(OrdersService);
  private readonly formDialogs = inject(FormDialogService);

  customer: Customer | null = null;
  orders: Order[] = [];
  loading = true;
  notFound = false;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.notFound = true;
        this.loading = false;
        return;
      }
      this.loadCustomer(id);
    });
  }

  get activeOrders(): Order[] {
    return this.orders.filter((o) => isActiveOrder(o.status));
  }

  get finishedOrders(): Order[] {
    return this.orders.filter((o) => isFinishedOrder(o.status));
  }

  get totalSpent(): number {
    return this.finishedOrders.reduce((sum, order) => sum + order.total, 0);
  }

  loadCustomer(id: string): void {
    this.loading = true;
    this.notFound = false;

    forkJoin({
      customer: this.customersService.getCustomer(id),
      orders: this.ordersService.getOrders({ customerId: id }),
    }).subscribe({
      next: ({ customer, orders }) => {
        this.customer = customer;
        this.orders = orders;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.notFound = err.status === 404;
      },
    });
  }

  openEdit(): void {
    if (!this.customer) return;

    this.formDialogs.openCustomer(this.customer).subscribe((updated) => {
      if (updated) this.customer = updated;
    });
  }

  addOrder(): void {
    if (!this.customer) return;

    this.formDialogs
      .openOrder(null, { presetCustomerId: this.customer.id })
      .subscribe((saved) => {
        if (saved) {
          this.orders = [saved, ...this.orders];
        }
      });
  }

  addSale(): void {
    this.formDialogs.openSale().subscribe();
  }

  deleteCustomer(): void {
    if (!this.customer) return;
    if (!confirm(`¿Eliminar a "${this.customer.name}"?`)) return;

    this.customersService.deleteCustomer(this.customer.id).subscribe({
      next: () => this.router.navigate(['/clientes']),
      error: (err) => {
        alert(
          extractApiErrorMessage(err, 'No se pudo eliminar el cliente'),
        );
      },
    });
  }
}
