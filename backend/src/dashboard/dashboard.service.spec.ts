import { OrderStatus } from '../common/enums';
import { DashboardService } from './dashboard.service';
import { SalesService } from '../sales/sales.service';
import {
  OrderRepository,
  ProductRepository,
  RetailSaleRepository,
} from '../store/repositories';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';

describe('DashboardService', () => {
  let store: StoreService;
  let service: DashboardService;

  beforeEach(() => {
    store = new StoreService();
    store.applyState(createEmptyState());
    const sales = new SalesService(
      new RetailSaleRepository(store),
      new OrderRepository(store),
      new ProductRepository(store),
      {} as never,
    );
    service = new DashboardService(store, sales);
  });

  it('calcula tendencia mensual de pedidos e ingresos', () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 5);

    store.orders.push({
      id: 'ord-1',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [],
      items: [],
      status: OrderStatus.PENDIENTE,
      total: 0,
      createdAt: monthStart.toISOString(),
      dueDate: monthStart.toISOString(),
    });

    store.retailSales.push({
      id: 'sale-1',
      items: [],
      total: 1500,
      soldAt: monthStart.toISOString(),
      createdAt: monthStart.toISOString(),
    });

    const stats = service.getStats();

    expect(stats.monthlyTrend).toHaveLength(6);
    const current = stats.monthlyTrend.at(-1);
    expect(current?.ordersCount).toBe(1);
    expect(current?.revenue).toBe(1500);
  });

  it('excluye pedidos completados, entregados y cancelados de recientes', () => {
    const baseOrder = {
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [],
      items: [],
      total: 0,
      dueDate: '2026-07-10T18:00:00.000Z',
    };

    store.orders.push(
      {
        ...baseOrder,
        id: 'ord-open',
        status: OrderStatus.EN_PRODUCCION,
        createdAt: '2026-07-09T10:00:00.000Z',
      },
      {
        ...baseOrder,
        id: 'ord-done',
        status: OrderStatus.COMPLETADO,
        createdAt: '2026-07-10T10:00:00.000Z',
      },
      {
        ...baseOrder,
        id: 'ord-delivered',
        status: OrderStatus.ENTREGADO,
        createdAt: '2026-07-11T10:00:00.000Z',
      },
    );
    store.indexOrder(store.orders[0]!);
    store.indexOrder(store.orders[1]!);
    store.indexOrder(store.orders[2]!);

    const stats = service.getStats();

    expect(stats.recentOrders.map((order) => order.id)).toEqual(['ord-open']);
  });
});
