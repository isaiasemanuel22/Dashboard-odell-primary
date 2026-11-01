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
import { BehaviorSubject, catchError, of, switchMap } from 'rxjs';
import {
  ClientReceivable,
  DashboardMarginAlert,
  DashboardPeriod,
  DashboardRankBy,
  DashboardStats,
  Order,
  ServiceType,
} from '../../core/models';
import { DashboardService } from '../../core/services/dashboard.service';
import { OrdersService } from '../../core/services/orders.service';
import { ProductsService } from '../../core/services/products.service';
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
  DbSegmentedControlComponent,
  DbSegmentOption,
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
import {
  DashboardAttentionComponent,
  DashboardAttentionItem,
} from './components/dashboard-attention/dashboard-attention.component';
import { DashboardChannelsComponent } from './components/dashboard-channels/dashboard-channels.component';
import { DashboardMarginAlertsComponent } from './components/dashboard-margin-alerts/dashboard-margin-alerts.component';
import { DashboardRankingComponent } from './components/dashboard-ranking/dashboard-ranking.component';

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
    DbSegmentedControlComponent,
    DbStateMessageComponent,
    DashboardMonthlyTrendsComponent,
    DashboardNotificationsComponent,
    DashboardAttentionComponent,
    DashboardChannelsComponent,
    DashboardMarginAlertsComponent,
    DashboardRankingComponent,
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
  private readonly productsService = inject(ProductsService);
  private readonly realtime = inject(RealtimeService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  loadError = false;
  readonly isProd = environment.production;

  period: DashboardPeriod = 'month';
  rankBy: DashboardRankBy = 'profit';

  readonly periodOptions: DbSegmentOption<DashboardPeriod>[] = [
    { value: 'month', label: 'Mes' },
    { value: 'quarter', label: 'Trimestre' },
    { value: 'year', label: 'Año' },
  ];

  readonly serviceOrder: ServiceType[] = [
    ServiceType.IMPRESION_3D,
    ServiceType.ESTAMPADO,
    ServiceType.DISENO_GRAFICO,
    ServiceType.MODELADO,
  ];

  stats$ = this.refresh$.pipe(
    switchMap(() =>
      this.dashboard.getStats({ period: this.period, rankBy: this.rankBy }).pipe(
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

  setPeriod(period: DashboardPeriod): void {
    if (this.period === period) return;
    this.period = period;
    this.loadError = false;
    this.refresh$.next();
  }

  setRankBy(rankBy: DashboardRankBy): void {
    if (this.rankBy === rankBy) return;
    this.rankBy = rankBy;
    this.loadError = false;
    this.refresh$.next();
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

  headerSubtitle(): string {
    return `${this.periodHeading()} · el estado general del emprendimiento de un vistazo`;
  }

  private periodHeading(): string {
    if (this.period === 'quarter') {
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3) + 1;
      return `T${quarter} ${now.getFullYear()}`;
    }
    if (this.period === 'year') {
      return String(new Date().getFullYear());
    }
    return this.currentMonthLabel();
  }

  currentMonthLabel(): string {
    const label = new Date().toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    });
    const cleaned = label.replace(' de ', ' ');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  periodHintWord(): string {
    if (this.period === 'quarter') return 'este trimestre';
    if (this.period === 'year') return 'este año';
    return 'este mes';
  }

  netProfitHint(fees: number): string {
    return `Después de costos y comisiones (${this.formatMoney(fees)})`;
  }

  receivableHint(count: number): string {
    if (count === 1) return '1 pedido entregado con saldo';
    return `${count} pedidos entregados con saldo`;
  }

  overdueHint(count: number): string {
    return count === 1 ? '1 atrasado' : `${count} atrasados`;
  }

  pendingHint(overdue: number): string {
    const overdueText =
      overdue > 0
        ? this.overdueHint(overdue)
        : 'sin atrasados';
    return `${overdueText} · esperan iniciar`;
  }

  productionHint(stats: DashboardStats): string {
    const printing =
      stats.activePrintJobs === 1
        ? '1 imprimiendo'
        : `${stats.activePrintJobs} imprimiendo`;
    const queued =
      stats.queuedPrintJobs === 1
        ? '1 en cola'
        : `${stats.queuedPrintJobs} en cola`;
    return `${printing} · ${queued}`;
  }

  lowStockHint(count: number): string {
    return count === 1 ? 'Insumo a reponer' : 'Insumos a reponer';
  }

  inProgressCount(stats: DashboardStats): number {
    return stats.pendingOrders + stats.inProductionOrders;
  }

  inProgressHint(stats: DashboardStats): string {
    return `Pendientes + en producción · ${stats.totalOrders} en total`;
  }

  attentionItems(stats: DashboardStats): DashboardAttentionItem[] {
    const items: DashboardAttentionItem[] = [];

    if (stats.overdueOrders > 0) {
      const overdueNotes = stats.notifications.filter(
        (note) => note.kind === 'order' && /atrasado/i.test(note.title),
      );
      const detail = overdueNotes
        .slice(0, 2)
        .map((note) => {
          const match = note.title.match(/Pedido\s+(\S+)/i);
          const id = match?.[1] ?? note.title;
          return id;
        })
        .join(' y ');
      items.push({
        id: 'overdue',
        tone: 'danger',
        title:
          stats.overdueOrders === 1
            ? '1 pedido atrasado'
            : `${stats.overdueOrders} pedidos atrasados`,
        detail,
        actionLabel: 'Ver pedidos',
        route: '/pedidos',
      });
    }

    const profit = stats.profitability;
    if (profit.receivable > 0) {
      const lines = this.receivableLines(stats.receivables);
      const oldest = lines[0];
      const detail = oldest
        ? `${oldest.id} lleva ${oldest.days} ${oldest.days === 1 ? 'día' : 'días'} entregado sin pagar`
        : '';
      items.push({
        id: 'receivable',
        tone: 'danger',
        title: `${this.formatMoney(profit.receivable)} por cobrar`,
        detail,
        actionLabel: 'Ver por cobrar',
        route: '/dashboard',
        fragment: 'por-cobrar',
      });
    }

    if (stats.lowStockMaterials > 0) {
      const stockNotes = stats.notifications.filter(
        (note) => note.kind === 'stock',
      );
      const names = stockNotes
        .slice(0, 2)
        .map((note) =>
          note.title.replace(/^Stock bajo:\s*/i, '').replace(/\s+sin stock$/i, ''),
        )
        .filter(Boolean);
      const first = stockNotes[0];
      items.push({
        id: 'stock',
        tone: 'warn',
        title:
          names.length > 0
            ? `Pedí ${names.join(' · ')}`
            : stats.lowStockMaterials === 1
              ? '1 insumo con stock bajo'
              : `${stats.lowStockMaterials} insumos con stock bajo`,
        detail: first?.message ?? this.lowStockHint(stats.lowStockMaterials),
        actionLabel: 'Ver insumos',
        route: first?.route?.split('?')[0] || '/insumos',
      });
    }

    if (profit.marginAlerts.length > 0) {
      const count = profit.marginAlerts.length;
      const target = profit.marginAlerts[0]?.targetPercent ?? 40;
      items.push({
        id: 'margin',
        tone: 'warn',
        title:
          count === 1
            ? `1 producto bajo el ${target}% de margen`
            : `${count} productos bajo el ${target}% de margen`,
        detail: 'revisá costos y precios',
        actionLabel: 'Actualizar precios',
        route: '/productos',
        fragment: 'masiva',
      });
    }

    return items;
  }

  raiseProductPrice(alert: DashboardMarginAlert): void {
    this.productsService.getProduct(alert.productId).subscribe({
      next: (product) => {
        this.formDialogs.openProduct(product).subscribe((saved) => {
          if (saved) this.refresh$.next();
        });
      },
      error: () => {
        void this.router.navigate(['/productos']);
      },
    });
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
    return Math.max(
      0,
      Math.round((today.getTime() - then.getTime()) / 86_400_000),
    );
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

  private formatMoney(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
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
    {
      key: 'services',
      header: 'Áreas',
      type: 'tags',
      tags: (order) => order.services.map(serviceTag),
    },
    {
      key: 'dueDate',
      header: 'Entrega',
      type: 'date',
      note: (order) =>
        isOrderOverdue(order.dueDate, order.status)
          ? { text: 'Atrasado', tone: 'danger' }
          : null,
    },
    {
      key: 'status',
      header: 'Estado',
      type: 'badge',
      badge: (order) => orderStatusBadge(order.status),
    },
    { key: 'total', header: 'Total', type: 'money' },
  ];

  onRecentAction(event: OdlActionEvent<Order>): void {
    if (event.actionId === 'eliminar') this.deleteRecent(event.row);
  }

  private orderSummary(order: Order): string {
    const products = order.items.length;
    const units = order.items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    );
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
                message: extractApiErrorMessage(
                  err,
                  'No se pudo cancelar el pedido',
                ),
                confirmLabel: 'Entendido',
                alertOnly: true,
              })
              .subscribe();
          },
        });
      });
  }
}
