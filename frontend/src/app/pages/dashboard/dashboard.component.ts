import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, of, startWith, switchMap } from 'rxjs';
import { ClientReceivable, DashboardStats, Order, ServiceType } from '../../core/models';
import { DashboardService } from '../../core/services/dashboard.service';
import { OrdersService } from '../../core/services/orders.service';
import { RealtimeService } from '../../core/services/realtime.service';
import {
  CurrencyArsPipe,
  ServiceTypeLabelPipe,
} from '../../shared/pipes/labels.pipe';
import { FormDialogService } from '../../shared/form-dialogs/public-api';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { cancelOrderConfirmMessage } from '../../shared/utils/order.helpers';
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

interface ReceivableLine {
  id: string;
  customerName: string;
  contact: string;
  summary: string;
  deliveredAt: string;
  days: number;
  balance: number;
  total: number;
}

const DEBT_RECENT_DAYS = 15;

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
  private readonly router = inject(Router);
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

  soldHint(amount: number): string {
    const month = this.currentMonthLabel();
    return amount > 0 ? month : `${month} · sin ventas cerradas`;
  }

  lowStockHint(count: number): string {
    return count === 1 ? 'Insumo a reponer' : 'Insumos a reponer';
  }

  deliveredUnpaidHint(rows: ClientReceivable[]): string {
    const count = rows.reduce((sum, row) => sum + row.orders.length, 0);
    if (count === 0) return 'Sin saldo impago';
    if (count === 1) return '1 pedido entregado sin pagar';
    return `${count} pedidos entregados sin pagar`;
  }

  ifCollected(stats: DashboardStats): number {
    return stats.walletBalance + stats.clientDebt;
  }

  receivableLines(rows: ClientReceivable[]): ReceivableLine[] {
    const lines: ReceivableLine[] = [];
    for (const row of rows) {
      for (const order of row.orders) {
        lines.push({
          id: order.id,
          customerName: row.customerName || 'Sin cliente',
          contact: row.phone || row.company || '',
          summary: order.summary,
          deliveredAt: order.deliveredAt,
          days: this.daysSince(order.deliveredAt),
          balance: order.amount,
          total: order.total,
        });
      }
    }
    return lines.sort((a, b) => b.days - a.days || b.balance - a.balance);
  }

  oldDebtCount(lines: ReceivableLine[]): number {
    return lines.filter((line) => line.days > DEBT_RECENT_DAYS).length;
  }

  oldDebtLabel(count: number): string {
    return count === 1 ? '1 con más de 15 días' : `${count} con más de 15 días`;
  }

  bucketAmount(lines: ReceivableLine[], older: boolean): number {
    return lines
      .filter((line) => (line.days > DEBT_RECENT_DAYS) === older)
      .reduce((sum, line) => sum + line.balance, 0);
  }

  private daysSince(value: string): number {
    const then = new Date(value);
    if (Number.isNaN(then.getTime())) return 0;
    const today = new Date();
    then.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((today.getTime() - then.getTime()) / 86_400_000));
  }

  daysLabel(days: number): string {
    return days === 1 ? 'Hace 1 día' : `Hace ${days} días`;
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

  readonly receivableActions: OdlRowAction<ReceivableLine>[] = [
    { id: 'ver', label: 'Ver pedido' },
  ];

  readonly receivableColumns: OdlColumn<ReceivableLine>[] = [
    {
      key: 'customerName',
      header: 'Cliente',
      type: 'avatar',
      secondary: (row) => row.contact || null,
    },
    { key: 'id', header: 'Pedido' },
    {
      key: 'deliveredAt',
      header: 'Entregado',
      type: 'date',
      note: (row) => ({
        text: this.daysLabel(row.days),
        tone: 'warn',
      }),
    },
    { key: 'balance', header: 'Saldo', align: 'end' },
    {
      key: 'pago',
      header: '',
      type: 'button',
      buttonLabel: 'Registrar pago',
      align: 'end',
    },
  ];

  onReceivableAction(event: OdlActionEvent<ReceivableLine>): void {
    void this.router.navigate(['/pedidos', event.row.id], {
      fragment: event.actionId === 'pago' ? 'order-payments' : undefined,
    });
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
    this.formDialogs
      .openConfirm({
        title: 'Cancelar pedido',
        message: cancelOrderConfirmMessage(order),
        confirmLabel: 'Cancelar pedido',
        cancelLabel: 'Volver',
        confirmVariant: 'delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.ordersService.deleteOrder(order.id).subscribe({
          next: () => this.refresh$.next(),
          error: (err) => {
            this.formDialogs
              .openConfirm({
                title: 'No se pudo cancelar',
                message: extractApiErrorMessage(err, 'No se pudo cancelar el pedido'),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }
}
