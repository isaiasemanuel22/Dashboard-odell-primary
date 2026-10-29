import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, catchError, of, startWith, switchMap } from 'rxjs';
import { Order, ServiceType } from '../../core/models';
import { DashboardService } from '../../core/services/dashboard.service';
import { OrdersService } from '../../core/services/orders.service';
import { RealtimeService } from '../../core/services/realtime.service';
import {
  CurrencyArsPipe,
  ServiceTypeLabelPipe,
} from '../../shared/pipes/labels.pipe';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { environment } from '../../../environments/environment';
import {
  DB_DATA_TABLE,
  DbButtonComponent,
  DbStateMessageComponent,
  DashboardMonthlyTrendsComponent,
  DashboardNotificationsComponent,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
  OrderCardComponent,
  isOrderOverdue,
  orderStatusBadge,
  serviceTag,
} from '@general-components';

type QuickActionId = 'order' | 'quote' | 'product' | 'customer';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    AsyncPipe,
    RouterLink,
    CurrencyArsPipe,
    ServiceTypeLabelPipe,
    DbButtonComponent,
    DbStateMessageComponent,
    DashboardMonthlyTrendsComponent,
    DashboardNotificationsComponent,
    OrderCardComponent,
    ...DB_DATA_TABLE,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly dashboard = inject(DashboardService);
  private readonly ordersService = inject(OrdersService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly refresh$ = new Subject<void>();

  loadError = false;
  readonly isProd = environment.production;

  readonly serviceOrder: ServiceType[] = [
    ServiceType.IMPRESION_3D,
    ServiceType.ESTAMPADO,
    ServiceType.DISENO_GRAFICO,
    ServiceType.MODELADO,
  ];

  stats$ = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() =>
      this.dashboard.getStats().pipe(
        catchError(() => {
          this.loadError = true;
          this.cdr.markForCheck();
          return of(null);
        }),
      ),
    ),
  );

  ngOnInit(): void {
    this.realtime.bindReload(
      this.destroyRef,
      ['dashboard', 'orders', 'sales', 'print-jobs', 'customers', 'products'],
      () => this.refresh$.next(),
    );
  }

  openForm(action: QuickActionId): void {
    switch (action) {
      case 'order':
        this.formDialogs.openOrder().subscribe((saved) => {
          if (saved) this.refresh$.next();
        });
        break;
      case 'quote':
        this.formDialogs.openQuote().subscribe((saved) => {
          if (saved) this.refresh$.next();
        });
        break;
      case 'product':
        this.formDialogs.openProduct().subscribe((saved) => {
          if (saved) this.refresh$.next();
        });
        break;
      case 'customer':
        this.formDialogs.openCustomer().subscribe((saved) => {
          if (saved) this.refresh$.next();
        });
        break;
    }
  }

  currentMonthLabel(): string {
    const label = new Date().toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    });
    const cleaned = label.replace(' de ', ' ');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  overdueLabel(count: number): string {
    return count === 1 ? '1 pedido atrasado' : `${count} pedidos atrasados`;
  }

  overdueHint(count: number): string {
    return count === 1 ? '1 atrasado' : `${count} atrasados`;
  }

  orderedServices(
    items: { type: ServiceType; count: number }[],
  ): { type: ServiceType; count: number }[] {
    return this.serviceOrder.map(
      (type) => items.find((item) => item.type === type) ?? { type, count: 0 },
    );
  }

  serviceMax(items: { count: number }[]): number {
    return Math.max(1, ...items.map((item) => item.count));
  }

  readonly recentActions: OdlRowAction<Order>[] = [
    { id: 'eliminar', label: 'Eliminar', danger: true },
  ];

  readonly recentColumns: OdlColumn<Order>[] = [
    { key: 'id', header: 'Pedido', type: 'primary' },
    {
      key: 'customerName',
      header: 'Cliente',
      type: 'primary',
      value: (order) => order.customerName || 'Sin cliente',
      secondary: (order) => this.orderSummary(order),
    },
    { key: 'services', header: 'Áreas', type: 'tags', tags: (order) => order.services.map(serviceTag) },
    {
      key: 'dueDate',
      header: 'Entrega',
      type: 'date',
      note: (order) => (isOrderOverdue(order.dueDate, order.status) ? { text: 'Atrasado', tone: 'danger' } : null),
    },
    { key: 'status', header: 'Estado', type: 'badge', badge: (order) => orderStatusBadge(order.status) },
    { key: 'total', header: 'Total', type: 'money' },
  ];

  onRecentAction(event: OdlActionEvent<Order>): void {
    if (event.actionId === 'eliminar') this.deleteRecent(event.row);
  }

  private orderSummary(order: Order): string {
    const products = order.items.length;
    const units = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const productWord = products === 1 ? 'producto' : 'productos';
    const unitWord = units === 1 ? 'unidad' : 'unidades';
    return `${products} ${productWord} · ${units} ${unitWord}`;
  }

  editRecent(order: Order): void {
    this.formDialogs.openOrder(order).subscribe((saved) => {
      if (saved) this.refresh$.next();
    });
  }

  deleteRecent(order: Order): void {
    if (!confirm(`¿Eliminar el pedido ${order.id}?`)) return;
    this.ordersService.deleteOrder(order.id).subscribe({
      next: () => this.refresh$.next(),
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo eliminar el pedido'));
      },
    });
  }
}
