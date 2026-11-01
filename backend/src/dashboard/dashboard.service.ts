import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  PrintJobStatus,
  SaleSource,
  ServiceType,
} from '../common/enums';
import {
  ClientReceivable,
  DashboardLowStockItem,
  DashboardNotification,
  DashboardPeriod,
  DashboardProfitability,
  DashboardProfitabilityChannel,
  DashboardProfitabilityRankingItem,
  DashboardRankBy,
  DashboardStats,
  MonthlyTrendPoint,
  SaleEntry,
  SaleEntryItem,
} from '../common/interfaces';
import { CalendarService } from '../calendar/calendar.service';
import { SalesService } from '../sales/sales.service';
import { isRevenueOrder, resolveOrderSoldAt } from '../sales/sales-order.util';
import { ProductsService } from '../products/products.service';
import { StoreService } from '../store/store.service';
import { TreasuryService } from '../treasury/treasury.service';
import { computeDebtorBalances } from '../treasury/treasury-debtor.util';
import { listOrderPriceNotices } from '../orders/order-price-notice.util';
import {
  outstandingCents,
  paymentFeeCents,
  paymentNetCents,
  toCents,
} from '../common/utils/money.util';
import {
  getPeriodRange,
  isDateInMonthRange,
  MonthRange,
} from '../common/utils/month-range.util';

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const TREND_MONTHS = 6;
const RANKING_LIMIT = 10;
const CHANNEL_RETAIL = 'mostrador';
const CHANNEL_MISSING = 'sin_canal';

const RECENT_ORDERS_EXCLUDED_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETADO,
  OrderStatus.ENTREGADO,
  OrderStatus.CANCELADO,
];

@Injectable()
export class DashboardService {
  constructor(
    private readonly store: StoreService,
    private readonly salesService: SalesService,
    private readonly treasuryService: TreasuryService,
    private readonly calendarService: CalendarService,
    private readonly productsService: ProductsService,
  ) {}

  getStats(
    period: DashboardPeriod = 'month',
    rankBy: DashboardRankBy = 'profit',
  ): DashboardStats {
    const monthlyRevenue = this.salesService.getOverview().stats.monthlyRevenue;

    const ordersByType = Object.values(ServiceType).map((type) => ({
      type,
      count: this.store.orders.filter((o) => o.services.includes(type)).length,
    }));

    const recentOrders = [...this.store.orders]
      .filter(
        (order) => !RECENT_ORDERS_EXCLUDED_STATUSES.includes(order.status),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5);

    const receivables = this.listReceivables();
    const lowStockItems = this.listLowStockItems();

    return {
      totalOrders: this.store.orders.length,
      pendingOrders: this.store.orders.filter(
        (o) => o.status === OrderStatus.PENDIENTE,
      ).length,
      overdueOrders: this.store.orders.filter((order) =>
        this.isOrderOverdue(order),
      ).length,
      overduePendingOrders: this.store.orders.filter(
        (order) =>
          order.status === OrderStatus.PENDIENTE && this.isOrderOverdue(order),
      ).length,
      inProductionOrders: this.store.orders.filter(
        (o) => o.status === OrderStatus.EN_PRODUCCION,
      ).length,
      monthlyRevenue,
      walletBalance: this.treasuryService.getAvailableBalance(),
      clientDebt: receivables.clientDebt,
      receivables: receivables.rows,
      activePrintJobs: this.store.printJobs.filter(
        (j) => j.active && j.status === PrintJobStatus.EN_PROCESO,
      ).length,
      queuedPrintJobs: this.store.printJobs.filter(
        (j) => j.active && j.status === PrintJobStatus.POR_HACER,
      ).length,
      totalCustomers: this.store.customers.length,
      lowStockMaterials: lowStockItems.length,
      lowStockItems,
      ordersByType,
      recentOrders,
      monthlyTrend: this.buildMonthlyTrend(),
      notifications: this.buildNotifications(lowStockItems),
      profitability: this.buildProfitability(
        period,
        rankBy,
        receivables.clientDebt,
        receivables.orderCount,
      ),
    };
  }

  /** Mismo filtro que el KPI de stock bajo: quantity <= minStock. */
  private listLowStockItems(): DashboardLowStockItem[] {
    return this.store.supplies
      .filter((supply) => supply.quantity <= supply.minStock)
      .map((supply) => ({
        id: supply.id,
        name: supply.name,
        quantity: supply.quantity,
        unit: supply.unit,
        minStock: supply.minStock,
      }));
  }

  private buildProfitability(
    period: DashboardPeriod,
    rankBy: DashboardRankBy,
    receivable: number,
    receivableOrders: number,
  ): DashboardProfitability {
    const range = getPeriodRange(period);
    const entries = this.salesService
      .listEntries()
      .filter((entry) => isDateInMonthRange(new Date(entry.soldAt), range));

    const sold = entries.reduce((sum, entry) => sum + entry.total, 0);
    const periodProfit = entries.reduce((sum, entry) => sum + entry.profit, 0);
    const { collected, fees } = this.computeCollectedAndFees(range);
    const netProfit = periodProfit - fees;

    return {
      period,
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      sold,
      collected,
      fees,
      netProfit,
      receivable,
      receivableOrders,
      byChannel: this.buildByChannel(entries),
      ranking: this.buildRanking(entries, rankBy),
      marginAlerts: this.productsService.getMarginAlerts(),
    };
  }

  private computeCollectedAndFees(range: MonthRange): {
    collected: number;
    fees: number;
  } {
    let collectedCents = 0;
    let feesCents = 0;

    for (const order of this.store.orders) {
      for (const payment of order.payments ?? []) {
        const createdAt = new Date(payment.createdAt);
        if (!isDateInMonthRange(createdAt, range)) continue;
        collectedCents += paymentNetCents(payment);
        feesCents += paymentFeeCents(payment);
      }
    }

    for (const sale of this.store.retailSales) {
      const soldAt = new Date(sale.soldAt);
      if (!isDateInMonthRange(soldAt, range)) continue;
      collectedCents += toCents(sale.total);
    }

    return {
      collected: collectedCents / 100,
      fees: feesCents / 100,
    };
  }

  private buildByChannel(
    entries: SaleEntry[],
  ): DashboardProfitabilityChannel[] {
    const grouped = new Map<
      string,
      { sold: number; cost: number; profit: number }
    >();

    for (const entry of entries) {
      const channel = this.resolveEntryChannel(entry);
      const current = grouped.get(channel) ?? { sold: 0, cost: 0, profit: 0 };
      current.sold += entry.total;
      current.cost += entry.cost;
      current.profit += entry.profit;
      grouped.set(channel, current);
    }

    return [...grouped.entries()]
      .map(([channel, totals]) => ({
        channel,
        sold: totals.sold,
        cost: totals.cost,
        profit: totals.profit,
        markupPercent: this.markupPercent(totals.profit, totals.cost),
      }))
      .sort(
        (a, b) => b.sold - a.sold || a.channel.localeCompare(b.channel, 'es'),
      );
  }

  private buildRanking(
    entries: SaleEntry[],
    rankBy: DashboardRankBy,
  ): DashboardProfitabilityRankingItem[] {
    type Acc = {
      productId: string;
      productName: string;
      units: number;
      totalProfit: number;
      totalCost: number;
      channelUnits: Map<string, number>;
    };

    const byProduct = new Map<string, Acc>();

    for (const entry of entries) {
      const channel = this.resolveEntryChannel(entry);
      const subtotal = entry.items.reduce(
        (sum, item) => sum + item.lineTotal,
        0,
      );

      for (const item of entry.items) {
        const productId = item.productId?.trim();
        if (!productId) continue;

        const lineCost =
          this.salesService.resolveItemUnitCost(item) * item.quantity;
        const lineRevenue =
          subtotal > 0 ? (item.lineTotal / subtotal) * entry.total : 0;
        const lineProfit = lineRevenue - lineCost;

        const current = byProduct.get(productId) ?? {
          productId,
          productName: this.resolveProductName(productId, item),
          units: 0,
          totalProfit: 0,
          totalCost: 0,
          channelUnits: new Map<string, number>(),
        };
        current.units += item.quantity;
        current.totalProfit += lineProfit;
        current.totalCost += lineCost;
        current.channelUnits.set(
          channel,
          (current.channelUnits.get(channel) ?? 0) + item.quantity,
        );
        byProduct.set(productId, current);
      }
    }

    const items = [...byProduct.values()].map((row) => {
      const profitPerUnit = row.units > 0 ? row.totalProfit / row.units : 0;
      return {
        productId: row.productId,
        productName: row.productName,
        units: row.units,
        profitPerUnit,
        markupPercent: this.markupPercent(row.totalProfit, row.totalCost),
        totalProfit: row.totalProfit,
        mainChannel: this.resolveMainChannel(row.channelUnits),
        fixedPrice: this.productsService.isFixedPrice(row.productId),
      };
    });

    items.sort((a, b) => this.compareRanking(a, b, rankBy));
    return items.slice(0, RANKING_LIMIT);
  }

  private compareRanking(
    a: DashboardProfitabilityRankingItem,
    b: DashboardProfitabilityRankingItem,
    rankBy: DashboardRankBy,
  ): number {
    if (rankBy === 'units') {
      return (
        b.units - a.units ||
        b.totalProfit - a.totalProfit ||
        a.productName.localeCompare(b.productName, 'es')
      );
    }
    if (rankBy === 'markup') {
      const markupA = a.markupPercent ?? Number.NEGATIVE_INFINITY;
      const markupB = b.markupPercent ?? Number.NEGATIVE_INFINITY;
      return (
        markupB - markupA ||
        b.totalProfit - a.totalProfit ||
        a.productName.localeCompare(b.productName, 'es')
      );
    }
    return (
      b.totalProfit - a.totalProfit ||
      b.units - a.units ||
      a.productName.localeCompare(b.productName, 'es')
    );
  }

  private resolveProductName(productId: string, item: SaleEntryItem): string {
    return (
      this.store.getProductById(productId)?.name?.trim() || item.productName
    );
  }

  private resolveMainChannel(channelUnits: Map<string, number>): string {
    let bestChannel = CHANNEL_MISSING;
    let bestUnits = -1;
    for (const [channel, units] of channelUnits) {
      if (
        units > bestUnits ||
        (units === bestUnits && channel.localeCompare(bestChannel, 'es') < 0)
      ) {
        bestChannel = channel;
        bestUnits = units;
      }
    }
    return bestChannel;
  }

  private resolveEntryChannel(entry: SaleEntry): string {
    if (entry.source === SaleSource.RETAIL) return CHANNEL_RETAIL;
    return entry.salesChannel ?? CHANNEL_MISSING;
  }

  private markupPercent(profit: number, cost: number): number | null {
    if (!Number.isFinite(cost) || cost <= 0) return null;
    return (profit / cost) * 100;
  }

  private buildNotifications(
    lowStockItems: DashboardLowStockItem[] = this.listLowStockItems(),
  ): DashboardNotification[] {
    const notifications: DashboardNotification[] = [];

    for (const supply of lowStockItems) {
      const empty = Number(supply.quantity) <= 0;
      notifications.push({
        id: `low-stock-${supply.id}`,
        type: 'warning',
        kind: 'stock',
        title: empty
          ? `${supply.name} sin stock`
          : `Stock bajo: ${supply.name}`,
        message: `Quedan ${supply.quantity} ${supply.unit}`,
        route: '/insumos?filtro=stock_bajo',
      });
    }

    const blockedTasks = this.store.printJobs.filter(
      (job) =>
        job.active && !job.archived && job.status === PrintJobStatus.BLOQUEADO,
    );
    for (const job of blockedTasks) {
      const suppliesReady = !!job.suppliesAvailableNotifiedAt;
      notifications.push({
        id: `blocked-${job.id}`,
        type: suppliesReady ? 'success' : 'warning',
        kind: 'queue',
        title: suppliesReady ? 'Insumos disponibles' : 'Tarea bloqueada',
        message: suppliesReady
          ? `${job.productName}: podés desbloquear la producción`
          : `${job.productName}${job.blockedReason ? ` — ${job.blockedReason}` : ''}`,
        route: '/cola',
      });
    }

    const pendingOrders = this.store.orders.filter(
      (order) => order.status === OrderStatus.PENDIENTE,
    ).length;
    if (pendingOrders > 0) {
      notifications.push({
        id: 'pending-orders',
        type: 'info',
        kind: 'order',
        title: 'Pedidos pendientes',
        message:
          pendingOrders === 1
            ? '1 pedido esperando iniciar'
            : `${pendingOrders} pedidos esperando iniciar`,
        route: '/pedidos',
      });
    }

    for (const order of this.store.orders) {
      if (!this.isOrderOverdue(order)) continue;
      notifications.push({
        id: `overdue-${order.id}`,
        type: 'warning',
        kind: 'order',
        title: `Pedido ${order.id} atrasado`,
        message: `Entrega ${this.formatNotificationDate(order.dueDate)} · ${this.formatNotificationMoney(order.total)}`,
        route: `/pedidos/${order.id}`,
        areas: order.services,
      });
    }

    for (const order of this.store.orders) {
      const notices = listOrderPriceNotices(
        order,
        (productId) => this.store.getProductById(productId)?.price,
      );
      if (!notices.length) continue;
      notifications.push({
        id: `order-price-${order.id}`,
        type: 'warning',
        kind: 'order',
        title: 'Precio del pedido',
        message: `El producto cambió de precio. El valor del pedido ${order.id} sigue igual hasta actualizarlo en el pedido`,
        route: `/pedidos/${order.id}`,
        areas: order.services,
      });
    }

    for (const debtor of computeDebtorBalances(this.store.treasuryExpenses)) {
      notifications.push({
        id: `debtor-${debtor.name.toLocaleLowerCase('es')}`,
        type: 'warning',
        kind: 'other',
        title: 'Préstamo pendiente',
        message: `${debtor.name} debe $${debtor.amount.toLocaleString('es-AR')}`,
        route: '/billetera',
      });
    }

    for (const item of this.calendarService.buildNotifyCandidates()) {
      notifications.push({
        id: `calendar-${item.id}`,
        type: 'info',
        kind: 'calendar',
        title:
          item.type === 'reminder'
            ? `Recordatorio: ${item.title}`
            : `Evento: ${item.title}`,
        message: item.subtitle || item.date,
        route: '/calendario',
      });
    }

    return notifications;
  }

  private buildMonthlyTrend(): MonthlyTrendPoint[] {
    const now = new Date();
    const points: MonthlyTrendPoint[] = [];

    for (let offset = TREND_MONTHS - 1; offset >= 0; offset -= 1) {
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth() - offset,
        1,
      );
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() - offset + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const range: MonthRange = { start: monthStart, end: monthEnd };

      const month = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_LABELS[monthStart.getMonth()]} ${monthStart.getFullYear()}`;

      points.push({
        month,
        label,
        ordersCount: this.countOrdersReceived(monthStart, monthEnd),
        revenue: this.computeMonthRevenue(monthStart, monthEnd),
        collected: this.computeCollectedAndFees(range).collected,
      });
    }

    return points;
  }

  private countOrdersReceived(monthStart: Date, monthEnd: Date): number {
    return this.store.orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      return createdAt >= monthStart && createdAt <= monthEnd;
    }).length;
  }

  /** Saldo impago de pedidos ya entregados. No entra en la caja. */
  private listReceivables(): {
    clientDebt: number;
    rows: ClientReceivable[];
    orderCount: number;
  } {
    const grouped = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        phone?: string;
        company?: string;
        cents: number;
        orders: ClientReceivable['orders'];
      }
    >();
    let totalCents = 0;
    let orderCount = 0;

    for (const order of this.store.orders) {
      if (order.status !== OrderStatus.ENTREGADO) continue;
      const cents = outstandingCents(order);
      if (cents <= 0) continue;
      totalCents += cents;
      orderCount += 1;
      const key = order.customerId || order.customerName;
      const customer = order.customerId
        ? this.store.getCustomerById(order.customerId)
        : undefined;
      const row = grouped.get(key) ?? {
        customerId: order.customerId ?? '',
        customerName: order.customerName,
        phone: customer?.phone || undefined,
        company: customer?.company || undefined,
        cents: 0,
        orders: [] as ClientReceivable['orders'],
      };
      row.cents += cents;
      row.orders.push({
        id: order.id,
        amount: cents / 100,
        total: Number(order.total) || 0,
        deliveredAt: resolveOrderSoldAt(order),
        summary: this.receivableSummary(order),
      });
      grouped.set(key, row);
    }

    const rows = [...grouped.values()]
      .map((row) => ({
        customerId: row.customerId,
        customerName: row.customerName,
        ...(row.phone ? { phone: row.phone } : {}),
        ...(row.company ? { company: row.company } : {}),
        amount: row.cents / 100,
        orders: row.orders,
      }))
      .sort(
        (a, b) =>
          b.amount - a.amount ||
          a.customerName.localeCompare(b.customerName, 'es'),
      );

    return { clientDebt: totalCents / 100, rows, orderCount };
  }

  private receivableSummary(order: {
    items?: { productName?: string }[];
    description?: string;
  }): string {
    const names = (order.items ?? [])
      .map((item) => item.productName?.trim())
      .filter((name): name is string => !!name);
    if (names.length) return names.join(' · ');
    return (order.description ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private computeMonthRevenue(monthStart: Date, monthEnd: Date): number {
    const retailRevenue = this.store.retailSales
      .filter((sale) => {
        const soldAt = new Date(sale.soldAt);
        return soldAt >= monthStart && soldAt <= monthEnd;
      })
      .reduce((sum, sale) => sum + sale.total, 0);

    const ordersRevenue = this.store.orders
      .filter((order) => {
        if (!isRevenueOrder(order)) return false;
        const soldAt = new Date(resolveOrderSoldAt(order));
        return soldAt >= monthStart && soldAt <= monthEnd;
      })
      .reduce((sum, order) => sum + order.total, 0);

    return retailRevenue + ordersRevenue;
  }

  private isOrderOverdue(order: {
    status: OrderStatus;
    dueDate: string;
  }): boolean {
    if (
      order.status === OrderStatus.ENTREGADO ||
      order.status === OrderStatus.CANCELADO
    ) {
      return false;
    }

    const due = new Date(order.dueDate);
    if (Number.isNaN(due.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }

  private formatNotificationDate(value: string): string {
    return new Date(value).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private formatNotificationMoney(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
