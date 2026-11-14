import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { formatSupplyQuantity } from '../../shared/utils/supply-unit.util';
import { toSignal } from '@angular/core/rxjs-interop';
import { AsyncPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, map, of, switchMap } from 'rxjs';
import {
  ClientReceivable,
  CurrentUserProfile,
  DashboardLowStockItem,
  DashboardMarginAlert,
  DashboardPeriod,
  DashboardProfitability,
  DashboardProfitabilityChannel,
  DashboardProfitabilityRankingItem,
  DashboardRankBy,
  DashboardStats,
  MonthlyTrendPoint,
  Order,
  OrderStatus,
  ServiceType,
} from '../../core/models';
import {
  formatPercentInteger,
  formatPercentIntegerLabel,
} from '../../shared/utils/percent.util';
import { DashboardService } from '../../core/services/dashboard.service';
import { OrdersService } from '../../core/services/orders.service';
import { ProductsService } from '../../core/services/products.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { UserAccessService } from '../../core/services/user-access.service';
import {
  CurrencyArsPipe,
  ServiceTypeLabelPipe,
} from '../../shared/pipes/labels.pipe';
import { FormDialogService } from '../../modals/public-api';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { cancelOrderConfirmMessage } from '../../shared/utils/order.helpers';
import { salesChannelLabel } from '../../shared/utils/v1-labels.util';
import { environment } from '../../../environments/environment';
import {
  DB_DATA_TABLE,
  DbButtonComponent,
  DbPillGroupComponent,
  DbPillOption,
  DbSegmentedControlComponent,
  DbSegmentOption,
  DbStateMessageComponent,
  DashboardMonthlyTrendsComponent,
  DashboardNotificationsComponent,
  MobileBarComponent,
  MobileKpiGridComponent,
  MobilePeriodPickerComponent,
  OdlActionEvent,
  OdlColumn,
  OdlRowAction,
  OrderCardComponent,
  isOrderOverdue,
  orderStatusBadge,
  serviceTag,
  type MobileKpiItem,
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
    DbPillGroupComponent,
    DbSegmentedControlComponent,
    DbStateMessageComponent,
    DashboardMonthlyTrendsComponent,
    DashboardNotificationsComponent,
    MobileBarComponent,
    MobilePeriodPickerComponent,
    MobileKpiGridComponent,
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
  providers: [CurrencyArsPipe],
})
export class DashboardComponent implements OnInit {
  private readonly dashboard = inject(DashboardService);
  private readonly ordersService = inject(OrdersService);
  private readonly productsService = inject(ProductsService);
  private readonly realtime = inject(RealtimeService);
  private readonly userAccess = inject(UserAccessService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly currencyArs = inject(CurrencyArsPipe);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  loadError = false;
  readonly isProd = environment.production;

  period: DashboardPeriod = 'month';
  rankBy: DashboardRankBy = 'profit';
  /** Valor del enum para el KPI mobile «Pendientes» → /pedidos?estado=… */
  readonly pendingStatus = OrderStatus.PENDIENTE;

  /** Criterios de ranking mobile (mismos values que desktop). */
  readonly mobileRankOptions: DbPillOption<DashboardRankBy>[] = [
    { value: 'profit', label: 'Ganancia' },
    { value: 'markup', label: 'Margen %' },
    { value: 'units', label: 'Unidades' },
  ];

  private readonly profile = toSignal(
    this.userAccess.currentUser$.pipe(
      map((value) =>
        value && 'authenticated' in value && value.authenticated === false
          ? null
          : (value as CurrentUserProfile | null),
      ),
    ),
    { initialValue: null },
  );

  /** Saludo mobile: «Hola, Isaías» o «Hola» si no hay nombre. */
  readonly greetingTitle = computed(() => {
    const name = this.profile()?.displayName?.trim();
    if (!name) return 'Hola';
    const first = name.split(/\s+/)[0];
    return `Hola, ${first}`;
  });

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

  /** Etiqueta corta del período (mobile): «Noviembre 2026», «T4 2026», etc. */
  mobileMainKpis(profit: DashboardProfitability): MobileKpiItem[] {
    return [
      {
        label: 'Vendido',
        value: this.currencyArs.transform(profit.sold),
        hint: 'Pedidos entregados + mostrador',
      },
      {
        label: 'Cobrado',
        value: this.currencyArs.transform(profit.collected),
        hint: `Entró a tus cuentas ${this.periodHintWord()}`,
        tone: 'success',
      },
      {
        label: 'Ganancia neta',
        value: this.currencyArs.transform(profit.netProfit),
        hint: this.netProfitHint(profit.fees),
      },
      {
        label: 'Por cobrar',
        value: this.currencyArs.transform(profit.receivable),
        hint: this.receivableHint(profit.receivableOrders),
        tone: 'danger',
        link: '/dashboard',
        fragment: 'por-cobrar-m',
      },
    ];
  }

  periodLabel(): string {
    return this.periodHeading();
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

  /** Fragmento del ancla «por cobrar» en la versión mobile (evita id duplicado). */
  attentionFragment(item: DashboardAttentionItem): string | undefined {
    if (item.fragment === 'por-cobrar') return 'por-cobrar-m';
    return item.fragment;
  }

  /** Últimos 6 puntos de tendencia mensual para el gráfico CSS mobile. */
  mobileTrendPoints(trends: MonthlyTrendPoint[]): MonthlyTrendPoint[] {
    return trends.slice(-6);
  }

  mobileTrendMax(points: MonthlyTrendPoint[]): number {
    return Math.max(
      1,
      ...points.flatMap((point) => [point.revenue, point.collected]),
    );
  }

  mobileTrendHeight(value: number, max: number): number {
    if (max <= 0 || value <= 0) return 0;
    // Mínimo 3px para que montos chicos (ej. $131) no queden invisibles.
    return Math.max(3, Math.round((value / max) * 72));
  }

  /** Tooltip / aria de un par de barras del trend mobile. */
  mobileTrendPointTitle(point: MonthlyTrendPoint): string {
    return `${point.label}: vendido ${this.formatMoney(point.revenue)}, cobrado ${this.formatMoney(point.collected)}`;
  }

  /** Abreviatura de 3 letras del mes a partir del label del trend. */
  monthShort(label: string): string {
    const first = (label.split(/\s+/)[0] ?? label).trim();
    const short = first.slice(0, 3);
    return short.charAt(0).toUpperCase() + short.slice(1);
  }

  /** Hasta 5 filas del ranking mobile, con posición 1-based. */
  mobileRankingRows(
    ranking: DashboardProfitabilityRankingItem[],
  ): (DashboardProfitabilityRankingItem & { rank: number })[] {
    return ranking.slice(0, 5).map((row, index) => ({ ...row, rank: index + 1 }));
  }

  /** Valor principal según `rankBy` (ganancia / margen / unidades). */
  mobileRankPrimary(row: DashboardProfitabilityRankingItem): string {
    if (this.rankBy === 'markup') {
      return formatPercentIntegerLabel(row.markupPercent);
    }
    if (this.rankBy === 'units') {
      return String(row.units);
    }
    return this.formatMoney(row.totalProfit);
  }

  /** Dato complementario: unidades o margen, según el criterio activo. */
  mobileRankSecondary(row: DashboardProfitabilityRankingItem): string {
    if (this.rankBy === 'units') {
      return `Margen ${formatPercentIntegerLabel(row.markupPercent)}`;
    }
    const word = row.units === 1 ? 'unidad' : 'unidades';
    return `${row.units} ${word}`;
  }

  channelLabel(channel: string): string {
    return salesChannelLabel(channel) || channel;
  }

  channelMaxSold(channels: DashboardProfitabilityChannel[]): number {
    return Math.max(1, ...channels.map((row) => row.sold));
  }

  channelBarWidth(sold: number, max: number): number {
    return Math.max(2, (sold / Math.max(1, max)) * 100);
  }

  mobileTrendAriaLabel(points: MonthlyTrendPoint[]): string {
    if (!points.length) return 'Ingresos de los últimos 6 meses';
    const parts = points.map((point) => {
      const sold = this.formatMoney(point.revenue);
      const collected = this.formatMoney(point.collected);
      return `${point.label}: vendido ${sold}, cobrado ${collected}`;
    });
    return `Ingresos de los últimos 6 meses. ${parts.join('. ')}`;
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

  pendingCardHint(stats: DashboardStats): string {
    const overdue = stats.overduePendingOrders ?? 0;
    if (overdue > 0) {
      return `${this.overdueHint(overdue)} · esperan iniciar`;
    }
    return 'sin atrasados · esperan iniciar';
  }

  productionHint(stats: DashboardStats): string {
    const orders =
      stats.inProductionOrders === 1
        ? '1 pedido'
        : `${stats.inProductionOrders} pedidos`;
    const printing =
      stats.activePrintJobs === 1
        ? '1 imprimiendo'
        : `${stats.activePrintJobs} imprimiendo`;
    const queued =
      stats.queuedPrintJobs === 1
        ? '1 en cola'
        : `${stats.queuedPrintJobs} en cola`;
    return `${orders} · ${printing} · ${queued}`;
  }

  /** Lista de ids coherente con el total («ord-10, ord-11 y 1 más»). */
  private formatIdList(ids: string[], total: number): string {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return '';
    const shown = unique.slice(0, 2);
    const rest = Math.max(total, unique.length) - shown.length;
    if (rest > 0) return `${shown.join(', ')} y ${rest} más`;
    if (shown.length === 1) return shown[0];
    return shown.join(' y ');
  }

  capitalizeAttention(text: string): string {
    const value = text.trim();
    if (!value) return value;
    return value.charAt(0).toLocaleUpperCase('es') + value.slice(1);
  }

  lowStockHint(count: number): string {
    return count === 1 ? 'Insumo a reponer' : 'Insumos a reponer';
  }

  /** Hasta 3 nombres; si hay más, «y N más». */
  private lowStockNamesLabel(items: DashboardLowStockItem[]): string {
    const names = items
      .map((item) => item.name?.trim())
      .filter((name): name is string => Boolean(name));
    if (!names.length) return '';
    const shown = names.slice(0, 3);
    const rest = names.length - shown.length;
    if (rest > 0) return `${shown.join(' · ')} y ${rest} más`;
    return shown.join(' · ');
  }

  /** «Quedan 10,2 ml» / «Quedan 0 unidades» / «Quedan 1 unidad». */
  private formatLowStockRemaining(item: DashboardLowStockItem): string {
    const qty = Number(item.quantity) || 0;
    const rawUnit = (item.unit ?? '').trim() || 'unidad';
    return `Quedan ${formatSupplyQuantity(qty, rawUnit)}`;
  }

  inProgressCount(stats: DashboardStats): number {
    return stats.pendingOrders + stats.inProductionOrders;
  }

  /** Atrasados entre los pedidos en curso (pendientes + en progreso). */
  inProgressOverdueCount(stats: DashboardStats): number {
    return stats.overdueOrders;
  }

  attentionItems(stats: DashboardStats): DashboardAttentionItem[] {
    const items: DashboardAttentionItem[] = [];

    if (stats.overdueOrders > 0) {
      const overdueNotes = stats.notifications.filter(
        (note) => note.kind === 'order' && /atrasado/i.test(note.title),
      );
      const ids = overdueNotes.map((note) => {
        const match = note.title.match(/Pedido\s+(\S+)/i);
        return match?.[1] ?? note.title;
      });
      items.push({
        id: 'overdue',
        tone: 'danger',
        title:
          stats.overdueOrders === 1
            ? '1 pedido atrasado'
            : `${stats.overdueOrders} pedidos atrasados`,
        detail: this.formatIdList(ids, stats.overdueOrders),
        actionLabel: 'Ver pedidos',
        route: '/pedidos',
        queryParams: { filtro: 'atrasados' },
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

    const lowStockItems = stats.lowStockItems ?? [];
    if (lowStockItems.length > 0) {
      const count = lowStockItems.length;
      items.push({
        id: 'stock',
        tone: 'warn',
        title: count === 1 ? 'Reponer 1 insumo' : `Reponer ${count} insumos`,
        detail: this.lowStockNamesLabel(lowStockItems),
        actionLabel: 'Ver insumos',
        route: '/insumos',
        queryParams: { filtro: 'stock_bajo' },
      });
    } else if (stats.lowStockMaterials > 0) {
      const count = stats.lowStockMaterials;
      items.push({
        id: 'stock',
        tone: 'warn',
        title: count === 1 ? 'Reponer 1 insumo' : `Reponer ${count} insumos`,
        detail: this.lowStockHint(count),
        actionLabel: 'Ver insumos',
        route: '/insumos',
        queryParams: { filtro: 'stock_bajo' },
      });
    }

    if (profit.marginAlerts.length > 0) {
      const count = profit.marginAlerts.length;
      const target =
        formatPercentInteger(profit.marginAlerts[0]?.targetPercent) ?? '40';
      items.push({
        id: 'margin',
        tone: 'warn',
        title:
          count === 1
            ? `1 producto con el precio bajo el margen (${target}%)`
            : `${count} productos con el precio bajo el margen (${target}%)`,
        detail: 'revisá costos y precios',
        actionLabel: 'Actualizar precios',
        route: '/productos',
        queryParams: { filtro: 'below_margin' },
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
