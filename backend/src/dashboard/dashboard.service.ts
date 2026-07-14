import { Injectable } from '@nestjs/common';
import { OrderStatus, PrintJobStatus, ServiceType } from '../common/enums';
import { DashboardStats, MonthlyTrendPoint } from '../common/interfaces';
import { SalesService } from '../sales/sales.service';
import { isRevenueOrder } from '../sales/sales-order.util';
import { StoreService } from '../store/store.service';

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
      inProductionOrders: this.store.orders.filter(
        (o) => o.status === OrderStatus.EN_PRODUCCION,
      ).length,
      monthlyRevenue,
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
    };
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
        const dueDate = new Date(order.dueDate);
        return dueDate >= monthStart && dueDate <= monthEnd;
      })
      .reduce((sum, order) => sum + order.total, 0);

    return retailRevenue + ordersRevenue;
  }
}
