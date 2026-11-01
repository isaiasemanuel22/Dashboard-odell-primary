import {
  OrderStatus,
  PrintJobStatus,
  ProductType,
  ServiceType,
  SupplyCategory,
  TaskType,
} from '../common/enums';
import { DashboardService } from './dashboard.service';
import { SalesService } from '../sales/sales.service';
import { TreasuryService } from '../treasury/treasury.service';
import {
  OrderRepository,
  ProductRepository,
  RetailSaleRepository,
} from '../store/repositories';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { ProductsService } from '../products/products.service';
import { getPeriodRange } from '../common/utils/month-range.util';

describe('DashboardService', () => {
  let store: StoreService;
  let service: DashboardService;
  let productsService: { getMarginAlerts: jest.Mock; isFixedPrice: jest.Mock };

  beforeEach(() => {
    store = new StoreService();
    store.applyState(createEmptyState());
    const sales = new SalesService(
      new RetailSaleRepository(store),
      new OrderRepository(store),
      new ProductRepository(store),
      {
        resolveCatalogUnitCost: () => 0,
        resolveCatalogUnitPrice: () => 100,
        resolveDesignUnitCost: () => 0,
        resolveOrderItemUnitCost: () => 400,
      } as unknown as CostCalculatorService,
    );
    productsService = {
      getMarginAlerts: jest.fn().mockReturnValue([]),
      isFixedPrice: jest.fn().mockReturnValue(false),
    };
    service = new DashboardService(
      store,
      sales,
      {
        getAvailableBalance: () => sales.getTotalIncome(),
      } as TreasuryService,
      {
        buildNotifyCandidates: () => [],
      } as never,
      productsService as unknown as ProductsService,
    );
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
    expect(current?.collected).toBe(1500);
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
    store.indexOrder(store.orders[0]);
    store.indexOrder(store.orders[1]);
    store.indexOrder(store.orders[2]);

    const stats = service.getStats();

    expect(stats.recentOrders.map((order) => order.id)).toEqual(['ord-open']);
  });

  it('expone la billetera como dinero disponible del emprendimiento', () => {
    store.retailSales.push({
      id: 'sale-1',
      items: [],
      total: 5000,
      soldAt: '2026-07-01T12:00:00.000Z',
      createdAt: '2026-07-01T12:00:00.000Z',
    });

    const stats = service.getStats();

    expect(stats.walletBalance).toBe(5000);
  });

  it('suma como deuda el saldo impago de los pedidos entregados', () => {
    const base = {
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [],
      items: [],
      createdAt: '2026-07-01T12:00:00.000Z',
      dueDate: '2026-07-10T18:00:00.000Z',
    };

    store.orders.push(
      {
        ...base,
        id: 'ord-unpaid',
        status: OrderStatus.ENTREGADO,
        total: 120000,
      },
      {
        ...base,
        id: 'ord-partial',
        status: OrderStatus.ENTREGADO,
        total: 65000,
        payments: [
          {
            id: 'pay-1',
            amount: 20000,
            deposit: true,
            createdAt: '2026-07-02T12:00:00.000Z',
          },
        ],
      },
      {
        ...base,
        id: 'ord-open',
        status: OrderStatus.PENDIENTE,
        total: 80000,
      },
    );

    expect(service.getStats().clientDebt).toBe(165000);
    const receivables = service.getStats().receivables;
    expect(receivables).toEqual([
      {
        customerId: 'cust-1',
        customerName: 'Cliente',
        amount: 165000,
        orders: [
          {
            id: 'ord-unpaid',
            amount: 120000,
            total: 120000,
            deliveredAt: '2026-07-10T18:00:00.000Z',
            summary: '',
          },
          {
            id: 'ord-partial',
            amount: 45000,
            total: 65000,
            deliveredAt: '2026-07-10T18:00:00.000Z',
            summary: '',
          },
        ],
      },
    ]);
  });

  it('arma notificaciones operativas para el dashboard', () => {
    store.supplies.push({
      id: 'sup-1',
      name: 'PLA negro',
      category: SupplyCategory.FDM,
      unit: 'kg',
      quantity: 0.2,
      minStock: 1,
      unitPrice: 1000,
      priceFromSettings: false,
      updatedAt: '2026-07-01T12:00:00.000Z',
    });

    store.printJobs.push({
      id: 'job-1',
      orderId: 'ord-1',
      orderItemIndex: 0,
      customerName: 'Cliente',
      productName: 'Pieza demo',
      type: ServiceType.IMPRESION_3D,
      status: PrintJobStatus.BLOQUEADO,
      active: true,
      priority: 1,
      machine: 'Ender',
      estimatedHours: 2,
      dueDate: '2026-07-10T18:00:00.000Z',
      taskType: TaskType.PRODUCTION,
      quantity: 1,
      archived: false,
      blockedReason: 'Insumos insuficientes',
      suppliesAvailableNotifiedAt: '2026-07-09T10:00:00.000Z',
    });

    const stats = service.getStats();

    expect(
      stats.notifications.some((item) => item.id === 'low-stock-sup-1'),
    ).toBe(true);
    expect(
      stats.notifications.some((item) => item.id === 'blocked-job-1'),
    ).toBe(true);
    expect(
      stats.notifications.find((item) => item.id === 'blocked-job-1')?.type,
    ).toBe('success');
  });

  it('separa vendido, cobrado y por cobrar con seña parcial y comisión', () => {
    const now = new Date();
    const inMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      10,
      12,
      0,
      0,
    ).toISOString();

    store.orders.push({
      id: 'ord-partial-fee',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-a',
          productName: 'Pieza A',
          quantity: 1,
          unitPrice: 10000,
        },
      ],
      status: OrderStatus.ENTREGADO,
      total: 10000,
      createdAt: inMonth,
      dueDate: inMonth,
      deliveryHistory: [{ id: 'del-1', deliveredAt: inMonth, items: [] }],
      payments: [
        {
          id: 'pay-1',
          amount: 3000,
          fee: 150,
          deposit: true,
          createdAt: inMonth,
        },
      ],
    });

    const stats = service.getStats('month');
    const profit = stats.profitability;

    expect(profit.sold).toBe(10000);
    expect(profit.collected).toBe(2850);
    expect(profit.fees).toBe(150);
    expect(profit.receivable).toBe(7000);
    expect(profit.receivableOrders).toBe(1);
    // costo mock 400 → ganancia 9600 − fees 150
    expect(profit.netProfit).toBe(9450);
    expect(stats.monthlyTrend.at(-1)?.collected).toBe(2850);
  });

  it('netProfit resta las comisiones del período', () => {
    const now = new Date();
    const inMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      8,
      12,
      0,
      0,
    ).toISOString();

    store.retailSales.push({
      id: 'sale-profit',
      items: [
        {
          productId: 'prod-r',
          productName: 'Retail',
          quantity: 1,
          unitPrice: 2000,
          lineTotal: 2000,
        },
      ],
      total: 2000,
      soldAt: inMonth,
      createdAt: inMonth,
    });

    store.orders.push({
      id: 'ord-fee-only',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [],
      items: [],
      status: OrderStatus.PENDIENTE,
      total: 5000,
      createdAt: inMonth,
      dueDate: inMonth,
      payments: [
        {
          id: 'pay-fee',
          amount: 1000,
          fee: 100,
          deposit: true,
          createdAt: inMonth,
        },
      ],
    });

    const profit = service.getStats().profitability;
    // venta mostrador: profit 2000-400=1600; fees del pago 100
    expect(profit.fees).toBe(100);
    expect(profit.netProfit).toBe(1500);
  });

  it('byChannel agrupa pedido sin canal y venta de mostrador', () => {
    const now = new Date();
    const inMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      12,
      12,
      0,
      0,
    ).toISOString();

    store.orders.push({
      id: 'ord-no-channel',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Sin canal',
          quantity: 1,
          unitPrice: 5000,
        },
      ],
      status: OrderStatus.ENTREGADO,
      total: 5000,
      createdAt: inMonth,
      dueDate: inMonth,
      deliveryHistory: [{ id: 'del-1', deliveredAt: inMonth, items: [] }],
    });

    store.retailSales.push({
      id: 'sale-counter',
      items: [
        {
          productName: 'Mostrador',
          quantity: 1,
          unitPrice: 1500,
          lineTotal: 1500,
        },
      ],
      total: 1500,
      soldAt: inMonth,
      createdAt: inMonth,
    });

    const channels = service.getStats().profitability.byChannel;
    expect(channels.map((row) => row.channel)).toEqual([
      'sin_canal',
      'mostrador',
    ]);
    expect(channels[0].sold).toBe(5000);
    expect(channels[1].sold).toBe(1500);
  });

  it('ranking ordena por totalProfit y rankBy=units cambia el orden', () => {
    const now = new Date();
    const inMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      14,
      12,
      0,
      0,
    ).toISOString();

    store.products.push({
      id: 'prod-high-profit',
      name: 'Alto margen',
      type: ProductType.FDM,
      price: 5000,
      cost: 400,
      profit: 4600,
      stock: 10,
      createdAt: inMonth,
      updatedAt: inMonth,
    } as never);
    store.products.push({
      id: 'prod-high-units',
      name: 'Muchas unidades',
      type: ProductType.FDM,
      price: 1000,
      cost: 400,
      profit: 600,
      stock: 10,
      createdAt: inMonth,
      updatedAt: inMonth,
    } as never);

    store.retailSales.push(
      {
        id: 'sale-a',
        items: [
          {
            productId: 'prod-high-profit',
            productName: 'Alto margen',
            quantity: 1,
            unitPrice: 5000,
            lineTotal: 5000,
          },
        ],
        total: 5000,
        soldAt: inMonth,
        createdAt: inMonth,
      },
      {
        id: 'sale-b',
        items: [
          {
            productId: 'prod-high-units',
            productName: 'Muchas unidades',
            quantity: 5,
            unitPrice: 1000,
            lineTotal: 5000,
          },
        ],
        total: 5000,
        soldAt: inMonth,
        createdAt: inMonth,
      },
    );

    const byProfit = service.getStats('month', 'profit').profitability.ranking;
    expect(byProfit[0].productId).toBe('prod-high-profit');
    expect(byProfit[0].totalProfit).toBe(4600);
    expect(byProfit[1].productId).toBe('prod-high-units');
    expect(byProfit[1].units).toBe(5);

    const byUnits = service.getStats('month', 'units').profitability.ranking;
    expect(byUnits[0].productId).toBe('prod-high-units');
    expect(byUnits[0].units).toBe(5);
    expect(byUnits[1].productId).toBe('prod-high-profit');
  });

  it('período quarter incluye ventas de los 3 meses del trimestre', () => {
    const now = new Date();
    const quarter = getPeriodRange('quarter', now);
    // Mes del trimestre distinto al actual (siempre existe: el trimestre tiene 3 meses).
    const otherMonth =
      quarter.start.getMonth() === now.getMonth()
        ? quarter.start.getMonth() + 1
        : quarter.start.getMonth();
    const inOtherQuarterMonth = new Date(
      quarter.start.getFullYear(),
      otherMonth,
      5,
      12,
      0,
      0,
    );
    const beforeQuarter = new Date(
      quarter.start.getFullYear(),
      quarter.start.getMonth() - 1,
      20,
      12,
      0,
      0,
    );

    store.retailSales.push(
      {
        id: 'sale-in-q',
        items: [],
        total: 3000,
        soldAt: inOtherQuarterMonth.toISOString(),
        createdAt: inOtherQuarterMonth.toISOString(),
      },
      {
        id: 'sale-out-q',
        items: [],
        total: 9000,
        soldAt: beforeQuarter.toISOString(),
        createdAt: beforeQuarter.toISOString(),
      },
    );

    const monthStats = service.getStats('month').profitability;
    const quarterStats = service.getStats('quarter').profitability;

    expect(quarterStats.period).toBe('quarter');
    expect(monthStats.sold).toBe(0);
    expect(quarterStats.sold).toBe(3000);
    expect(new Date(quarterStats.from).getTime()).toBe(quarter.start.getTime());
    expect(new Date(quarterStats.to).getTime()).toBe(quarter.end.getTime());
  });

  it('reutiliza marginAlerts del ProductsService', () => {
    const alerts = [
      {
        productId: 'prod-low',
        name: 'Bajo',
        price: 100,
        cost: 90,
        markupPercent: 11,
        targetPercent: 40,
        priceForTarget: 126,
        fixedPrice: true,
      },
    ];
    productsService.getMarginAlerts.mockReturnValue(alerts);

    expect(service.getStats().profitability.marginAlerts).toEqual(alerts);
    expect(productsService.getMarginAlerts).toHaveBeenCalled();
  });
});
