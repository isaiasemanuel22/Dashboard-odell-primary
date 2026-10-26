import { Injectable } from '@nestjs/common';
import { OrderStatus, PrintJobStatus, ServiceType } from '../common/enums';
import {
  DashboardNotification,
  DashboardStats,
  MonthlyTrendPoint,
} from '../common/interfaces';
import { SalesService } from '../sales/sales.service';
import { isRevenueOrder, resolveOrderSoldAt } from '../sales/sales-order.util';
import { StoreService } from '../store/store.service';
import { TreasuryService } from '../treasury/treasury.service';
import { computeDebtorBalances } from '../treasury/treasury-debtor.util';
import { listOrderPriceNotices } from '../orders/order-price-notice.util';

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
  ) {}

  getStats(): DashboardStats {
    const monthlyRevenue = this.salesService.getOverview().stats.monthlyRevenue;

    const ordersByType = Object.values(ServiceType).map((type) => ({
      type,
      count: this.store.orders.filter((o) => o.services.includes(type)).length,
    }));

    const recentOrders = [...this.store.orders]
      .filter((order) => !RECENT_ORDERS_EXCLUDED_STATUSES.includes(order.status))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5);

    return {
      totalOrders: this.store.orders.length,
      pendingOrders: this.store.orders.filter(
        (o) => o.status === OrderStatus.PENDIENTE,
      ).length,
      overdueOrders: this.store.orders.filter((order) =>
        this.isOrderOverdue(order),
      ).length,
      inProductionOrders: this.store.orders.filter(
        (o) => o.status === OrderStatus.EN_PRODUCCION,
      ).length,
      monthlyRevenue,
      walletBalance: this.treasuryService.getAvailableBalance(),
      activePrintJobs: this.store.printJobs.filter(
        (j) => j.active && j.status === PrintJobStatus.EN_PROCESO,
      ).length,
      queuedPrintJobs: this.store.printJobs.filter(
        (j) => j.active && j.status === PrintJobStatus.POR_HACER,
      ).length,
      totalCustomers: this.store.customers.length,
      lowStockMaterials: this.store.supplies.filter(
        (s) => s.quantity <= s.minStock,
      ).length,
      ordersByType,
      recentOrders,
      monthlyTrend: this.buildMonthlyTrend(),
      notifications: this.buildNotifications(),
    };
  }

  private buildNotifications(): DashboardNotification[] {
    const notifications: DashboardNotification[] = [];

    const lowStockSupplies = this.store.supplies.filter(
      (supply) => supply.quantity <= supply.minStock,
    );
    for (const supply of lowStockSupplies) {
      const empty = Number(supply.quantity) <= 0;
      notifications.push({
        id: `low-stock-${supply.id}`,
        type: 'warning',
        kind: 'stock',
        title: empty ? `${supply.name} sin stock` : `Stock bajo: ${supply.name}`,
        message: `Quedan ${supply.quantity} ${supply.unit}`,
        route: '/insumos',
      });
    }

    const blockedTasks = this.store.printJobs.filter(
      (job) =>
        job.active &&
        !job.archived &&
        job.status === PrintJobStatus.BLOQUEADO,
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

      const month = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_LABELS[monthStart.getMonth()]} ${monthStart.getFullYear()}`;

      points.push({
        month,
        label,
        ordersCount: this.countOrdersReceived(monthStart, monthEnd),
        revenue: this.computeMonthRevenue(monthStart, monthEnd),
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
