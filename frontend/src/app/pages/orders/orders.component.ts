import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ActivatedRoute, Router } from '@angular/router';
import { Order, OrderStatus, ServiceType } from '../../core/models';
import { RealtimeEvent } from '../../core/models/realtime.model';
import { OrdersService } from '../../core/services/orders.service';
import { RealtimeCatalogSyncService } from '../../core/services/realtime-catalog-sync.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { removeById, upsertById } from '../../core/utils/replace-in-store';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import {
  DbListToolbarComponent,
  DbSkeletonComponent,
  DbStateMessageComponent,
  DbButtonComponent,
  OrderCardComponent,
} from '@general-components';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { plainTextFromHtml } from '../../shared/utils/rich-text.util';
import {
  clearCreateQuery,
  shouldOpenCreateFromQuery,
} from '../../shared/utils/create-from-query.util';
import {
  OrderServiceFilter,
  OrderStatusFilter,
  orderServiceFilters,
  orderStatusFilters,
} from '../../shared/utils/order.helpers';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    FormsModule,
    ScrollingModule,
    DbStateMessageComponent,
    DbSkeletonComponent,
    DbListToolbarComponent,
    DbButtonComponent,
    OrderCardComponent,
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersComponent implements OnInit {
  private readonly ordersService = inject(OrdersService);
  private readonly catalogSync = inject(RealtimeCatalogSyncService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  orders: Order[] = [];
  loading = true;
  search = '';
  statusFilter: OrderStatusFilter = 'abiertos';
  serviceFilter: OrderServiceFilter = 'all';

  readonly statusFilters = orderStatusFilters();
  readonly serviceFilters = orderServiceFilters();

  ngOnInit(): void {
    this.loadOrders();
    this.realtime.bindSmartReload(
      this.destroyRef,
      ['orders', 'customers', 'products'],
      (event) => this.handleRealtime(event),
    );

    if (shouldOpenCreateFromQuery(this.route)) {
      this.openCreateOrder();
      clearCreateQuery(this.router);
    }
  }

  get filteredOrders(): Order[] {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.orders;
    return this.orders.filter((order) =>
      [
        order.id,
        order.customerName,
        plainTextFromHtml(order.description),
        order.notes ?? '',
        ...order.items.map((item) => item.productName),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }

  get emptyMessage(): string {
    if (this.search.trim()) {
      return 'No hay pedidos que coincidan con los filtros.';
    }
    if (this.statusFilter === 'abiertos') {
      return 'No hay pedidos abiertos.';
    }
    if (this.statusFilter !== 'all' || this.serviceFilter !== 'all') {
      return 'No hay pedidos que coincidan con los filtros.';
    }
    return 'No hay pedidos registrados.';
  }

  setStatusFilter(filter: OrderStatusFilter): void {
    this.statusFilter = filter;
    this.loadOrders();
  }

  setServiceFilter(filter: OrderServiceFilter): void {
    this.serviceFilter = filter;
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.ordersService.getOrders(this.buildQuery()).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  openCreateOrder(): void {
    this.formDialogs.openOrder().subscribe((saved) => {
      if (saved) this.onOrderSaved(saved);
    });
  }

  openEditOrder(order: Order): void {
    this.formDialogs.openOrder(order).subscribe((saved) => {
      if (saved) this.onOrderSaved(saved);
    });
  }

  onOrderSaved(saved: Order): void {
    this.orders = upsertById(this.orders, saved);
    this.cdr.markForCheck();
  }

  deleteOrder(order: Order): void {
    if (!confirm(`¿Eliminar el pedido ${order.id}?`)) return;

    const previous = this.orders;
    this.orders = removeById(this.orders, order.id);
    this.cdr.markForCheck();

    this.ordersService.deleteOrder(order.id).subscribe({
      error: (err) => {
        this.orders = previous;
        this.cdr.markForCheck();
        alert(extractApiErrorMessage(err, 'No se pudo eliminar el pedido'));
      },
    });
  }

  private handleRealtime(event: RealtimeEvent): void {
    this.catalogSync.handleEvent(event);
    this.loadOrders();
  }

  private buildQuery() {
    const query: {
      openOnly?: boolean;
      status?: OrderStatus;
      service?: ServiceType;
    } = {};

    if (this.statusFilter === 'abiertos') {
      query.openOnly = true;
    } else if (this.statusFilter !== 'all') {
      query.status = this.statusFilter;
    }

    if (this.serviceFilter !== 'all') {
      query.service = this.serviceFilter;
    }

    return query;
  }
}
