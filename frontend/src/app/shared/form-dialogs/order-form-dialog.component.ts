import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { forkJoin } from 'rxjs';
import {
  CreateOrderPayload,
  Customer,
  Order,
  Product,
  UpdateOrderPayload,
} from '../../core/models';
import { CustomerCatalogService } from '../../core/services/customer-catalog.service';
import { OrdersService } from '../../core/services/orders.service';
import { ProductCatalogService } from '../../core/services/product-catalog.service';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';
import { extractApiErrorMessage } from '../utils/api-error';
import { OrderFormComponent } from '../../pages/orders/order-form/order-form.component';

export interface OrderFormDialogData {
  order: Order | null;
  presetCustomerId?: string;
}

@Component({
  standalone: true,
  imports: [FormDialogShellComponent, OrderFormComponent],
  template: `
    <app-form-dialog-shell
      [title]="order ? 'Editar pedido' : 'Nuevo pedido'"
      size="lg"
      [stickyHeader]="true"
      (close)="cancel()"
    >
      <app-order-form
        [order]="order"
        [customers]="customers"
        [products]="products"
        [presetCustomerId]="presetCustomerId"
        [loading]="loading"
        [error]="error"
        (save)="save($event)"
        (cancel)="cancel()"
        (customerCreated)="onCustomerCreated($event)"
      />
    </app-form-dialog-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderFormDialogComponent implements OnInit {
  private readonly ordersService = inject(OrdersService);
  private readonly customerCatalog = inject(CustomerCatalogService);
  private readonly productCatalog = inject(ProductCatalogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogRef = inject(DialogRef<Order>);
  private readonly data = inject<OrderFormDialogData>(DIALOG_DATA);

  order: Order | null = null;
  presetCustomerId = '';
  customers: Customer[] = [];
  products: Product[] = [];
  loading = false;
  error = '';

  ngOnInit(): void {
    this.order = this.data.order;
    this.presetCustomerId = this.data.presetCustomerId ?? '';
    this.resetState();
    this.loadCatalogs();
  }

  save(data: CreateOrderPayload): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const request = this.order
      ? this.ordersService.updateOrder(
          this.order.id,
          data as UpdateOrderPayload,
        )
      : this.ordersService.createOrder(data);

    request.subscribe({
      next: (saved) => {
        this.loading = false;
        this.dialogRef.close(saved);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'Error al guardar el pedido');
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  onCustomerCreated(customer: Customer): void {
    const exists = this.customers.some((item) => item.id === customer.id);
    this.customers = exists
      ? this.customers.map((item) =>
          item.id === customer.id ? customer : item,
        )
      : [...this.customers, customer].sort((a, b) =>
          a.name.localeCompare(b.name, 'es'),
        );
    this.cdr.markForCheck();
  }

  private loadCatalogs(): void {
    forkJoin({
      customers: this.customerCatalog.getCustomers(),
      products: this.productCatalog.getAllProducts(),
    }).subscribe({
      next: ({ customers, products }) => {
        this.customers = customers;
        this.products = products;
        this.cdr.markForCheck();
      },
    });
  }

  private resetState(): void {
    this.loading = false;
    this.error = '';
    this.cdr.markForCheck();
  }
}
