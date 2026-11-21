import {
  OrderStatus,
  PaymentMethod,
  ProductType,
  ServiceType,
} from '../common/enums';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import {
  OrderRepository,
  ProductRepository,
  RetailSaleRepository,
  FairRepository,
} from '../store/repositories';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { isRevenueOrder } from './sales-order.util';
import { SalesService } from './sales.service';

describe('SalesService order revenue', () => {
  let store: StoreService;
  let service: SalesService;

  beforeEach(() => {
    store = new StoreService();
    store.applyState(createEmptyState());
    const retailSales = new RetailSaleRepository(store);
    const orders = new OrderRepository(store);
    const products = new ProductRepository(store);
    service = new SalesService(
      retailSales,
      orders,
      products,
      {
        resolveCatalogUnitCost: () => 0,
        resolveCatalogUnitPrice: () => 100,
        resolveDesignUnitCost: () => 0,
        resolveOrderItemUnitCost: () => 0,
      } as unknown as CostCalculatorService,
      new FairRepository(store),
    );
  });

  it('solo incluye pedidos entregados en el listado de ventas', () => {
    const now = new Date();
    const dueDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      15,
      18,
      0,
      0,
    ).toISOString();

    store.orders.push(
      {
        id: 'ord-completed',
        customerId: 'cust-1',
        customerName: 'Ana',
        services: [ServiceType.IMPRESION_3D],
        items: [
          {
            serviceType: ServiceType.IMPRESION_3D,
            productName: 'Pieza',
            quantity: 1,
            unitPrice: 1000,
          },
        ],
        status: OrderStatus.COMPLETADO,
        total: 1000,
        createdAt: dueDate,
        dueDate,
      },
      {
        id: 'ord-delivered',
        customerId: 'cust-1',
        customerName: 'Bruno',
        services: [ServiceType.IMPRESION_3D],
        items: [
          {
            serviceType: ServiceType.IMPRESION_3D,
            productName: 'Pieza',
            quantity: 1,
            unitPrice: 2500,
          },
        ],
        status: OrderStatus.ENTREGADO,
        total: 2500,
        createdAt: dueDate,
        dueDate,
      },
    );

    const { entries, stats } = service.getOverview();
    const orderEntries = entries.filter((entry) => entry.orderId);

    expect(isRevenueOrder(store.orders[0])).toBe(false);
    expect(isRevenueOrder(store.orders[1])).toBe(true);
    expect(orderEntries).toHaveLength(1);
    expect(orderEntries[0].orderId).toBe('ord-delivered');
    expect(stats.monthlyOrdersRevenue).toBe(2500);
    expect(stats.monthlyOrdersCount).toBe(1);
  });

  it('venta de mostrador a pérdida exige motivo', () => {
    const lossy = new SalesService(
      new RetailSaleRepository(store),
      new OrderRepository(store),
      new ProductRepository(store),
      {
        resolveCatalogUnitCost: () => 0,
        resolveCatalogUnitPrice: () => 100,
        resolveDesignUnitCost: () => 0,
        resolveOrderItemUnitCost: () => 500,
      } as unknown as CostCalculatorService,
      new FairRepository(store),
    );
    const dto = {
      items: [{ productName: 'Pieza', quantity: 1, unitPrice: 100 }],
    };
    expect(() => lossy.createRetail(dto)).toThrow(
      'Estás vendiendo a pérdida: indicá el motivo',
    );
    const sale = lossy.createRetail({ ...dto, lossReason: 'liquidacion' });
    expect(sale.lossReason).toBe('liquidacion');
    expect(lossy.updateRetail(sale.id, { notes: 'x' }).lossReason).toBe(
      'liquidacion',
    );
  });

  it('pasa la mano de obra de la línea al costo de la venta', () => {
    const resolveOrderItemUnitCost = jest.fn().mockReturnValue(1804);
    const checked = new SalesService(
      new RetailSaleRepository(store),
      new OrderRepository(store),
      new ProductRepository(store),
      {
        resolveCatalogUnitCost: () => 0,
        resolveCatalogUnitPrice: () => 100,
        resolveDesignUnitCost: () => 0,
        resolveOrderItemUnitCost,
      } as unknown as CostCalculatorService,
      new FairRepository(store),
    );
    const dueDate = new Date().toISOString();

    store.orders.push({
      id: 'ord-labor',
      customerId: 'cust-1',
      customerName: 'Carla',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Figura',
          quantity: 3,
          unitPrice: 8500,
          grams: 45,
          workTimeHours: 0.5,
        },
      ],
      status: OrderStatus.ENTREGADO,
      total: 25500,
      createdAt: dueDate,
      dueDate,
    });

    checked.getOverview();

    expect(resolveOrderItemUnitCost).toHaveBeenCalledWith(
      expect.objectContaining({ workTimeHours: 0.5, grams: 45 }),
    );
  });

  it('usa la fecha de entrega real para ubicar la venta en el mes', () => {
    const now = new Date();
    const dueDate = new Date(
      now.getFullYear(),
      now.getMonth() + 2,
      15,
      18,
      0,
      0,
    ).toISOString();
    const deliveredAt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      12,
      0,
      0,
    ).toISOString();

    store.orders.push({
      id: 'ord-delivered-today',
      customerId: 'cust-1',
      customerName: 'Carla',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 3000,
        },
      ],
      status: OrderStatus.ENTREGADO,
      total: 3000,
      createdAt: dueDate,
      dueDate,
      deliveryHistory: [
        {
          id: 'delivery-1',
          deliveredAt,
          items: [{ orderItemIndex: 0, quantity: 1 }],
        },
      ],
    });

    const { entries } = service.getOverview();
    const orderEntries = entries.filter((entry) => entry.orderId);

    expect(orderEntries).toHaveLength(1);
    expect(orderEntries[0]?.soldAt).toBe(deliveredAt);
  });

  it('en caja solo suma mostrador y pagos de pedidos, no el total al entregar', () => {
    const now = new Date().toISOString();
    store.retailSales.push({
      id: 'sale-cash',
      items: [],
      total: 17000,
      soldAt: now,
      createdAt: now,
    });
    store.orders.push(
      {
        id: 'ord-unpaid-delivered',
        customerId: 'cust-1',
        customerName: 'Ana',
        services: [ServiceType.IMPRESION_3D],
        items: [
          {
            serviceType: ServiceType.IMPRESION_3D,
            productName: 'Pieza',
            quantity: 1,
            unitPrice: 29500,
          },
        ],
        status: OrderStatus.ENTREGADO,
        total: 29500,
        payments: [],
        createdAt: now,
        dueDate: now,
      },
      {
        id: 'ord-with-deposit',
        customerId: 'cust-1',
        customerName: 'Bruno',
        services: [ServiceType.IMPRESION_3D],
        items: [
          {
            serviceType: ServiceType.IMPRESION_3D,
            productName: 'Pieza',
            quantity: 1,
            unitPrice: 100000,
          },
        ],
        status: OrderStatus.PENDIENTE,
        total: 100000,
        payments: [
          {
            id: 'pay-1',
            amount: 67600,
            deposit: true,
            createdAt: now,
          },
        ],
        createdAt: now,
        dueDate: now,
      },
    );

    expect(service.getCollectedIncome()).toBe(17000 + 67600);
    expect(service.getTotalIncome()).toBe(17000 + 29500);
  });

  it('valida y descuenta stock en ventas retail', () => {
    store.products.push({
      id: 'prod-stock',
      name: 'Producto terminado',
      type: ProductType.COMBO,
      images: [],
      attachments: [],
      updatedAt: new Date().toISOString(),
      price: 100,
      cost: 50,
      profit: 50,
      categoryIds: [],
      size: 'u',
      published: true,
      includesPieces: true,
      components: [],
      assemblyTimeHours: 0,
      stock: 2,
    });
    service.createRetail({
      items: [{ productId: 'prod-stock', quantity: 2, unitPrice: 0 }],
    });

    expect(store.products[0].stock).toBe(0);
    service.createRetail({
      items: [{ productId: 'prod-stock', quantity: 1, unitPrice: 0 }],
    });
    expect(store.products[0].stock).toBe(0);
  });

  it('al devolver stock ignora productos ya eliminados', () => {
    const base = {
      name: 'Producto',
      type: ProductType.FDM,
      images: [],
      attachments: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
      price: 100,
      cost: 50,
      profit: 50,
      categoryIds: [],
      size: 'u',
      published: true,
      includesPieces: true,
      components: [],
      assemblyTimeHours: 0,
    } as never;
    store.products.push(
      { ...(base as object), id: 'prod-a', stock: 5 } as never,
      { ...(base as object), id: 'prod-b', stock: 5 } as never,
    );
    const sale = service.createRetail({
      items: [
        { productId: 'prod-a', quantity: 1, unitPrice: 100 },
        { productId: 'prod-b', quantity: 2, unitPrice: 100 },
      ],
    });
    expect(store.products.find((p) => p.id === 'prod-b')?.stock).toBe(3);

    store.removeProduct('prod-b');

    expect(() => service.removeRetail(sale.id)).not.toThrow();
    expect(store.products.find((p) => p.id === 'prod-a')?.stock).toBe(5);
    expect(store.retailSales.find((s) => s.id === sale.id)).toBeUndefined();
  });
});

describe('SalesService §28: comisiones, canal, factura', () => {
  let store: StoreService;
  let service: SalesService;

  const noon = (iso: string) => `${iso}T15:00:00.000Z`;

  function order(partial: Record<string, unknown>) {
    return {
      customerId: 'cust-1',
      customerName: 'Ana',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
      status: OrderStatus.ENTREGADO,
      total: 1000,
      createdAt: noon('2026-11-05'),
      dueDate: noon('2026-11-05'),
      deliveryHistory: [
        {
          id: 'd1',
          deliveredAt: noon('2026-11-05'),
          items: [{ orderItemIndex: 0, quantity: 1 }],
        },
      ],
      ...partial,
    } as never;
  }

  beforeEach(() => {
    store = new StoreService();
    store.applyState(createEmptyState());
    store.generalSettings.integrations = {
      mercadoPago: { feePercent: 0 },
      arca: { pointOfSale: 3, annualCap: 5000000 },
      whatsapp: { businessPhone: '', templates: [] },
    };
    service = new SalesService(
      new RetailSaleRepository(store),
      new OrderRepository(store),
      new ProductRepository(store),
      {
        resolveCatalogUnitCost: () => 0,
        resolveCatalogUnitPrice: () => 100,
        resolveDesignUnitCost: () => 0,
        resolveOrderItemUnitCost: () => 400,
      } as unknown as CostCalculatorService,
      new FairRepository(store),
      store,
    );
  });

  it('pedido: canal, comisiones de pagos vigentes y ganancia neta', () => {
    store.orders.push(
      order({
        id: 'ord-a',
        salesChannel: 'instagram',
        payments: [
          {
            id: 'p1',
            amount: 600,
            deposit: true,
            createdAt: noon('2026-11-01'),
            method: PaymentMethod.MERCADO_PAGO,
            fee: 30,
          },
          {
            id: 'p2',
            amount: 400,
            deposit: false,
            createdAt: noon('2026-11-05'),
            method: PaymentMethod.EFECTIVO,
          },
          {
            id: 'p3',
            amount: 100,
            deposit: false,
            createdAt: noon('2026-11-05'),
            method: PaymentMethod.TRANSFERENCIA,
            fee: 99,
            voidedAt: noon('2026-11-06'),
          },
        ],
      }),
      order({ id: 'ord-b' }),
    );
    const { entries } = service.getOverview('2026-11');
    const a = entries.find((e) => e.orderId === 'ord-a')!;
    const b = entries.find((e) => e.orderId === 'ord-b')!;
    expect(a.channel).toBe('instagram');
    expect(a.fees).toBe(30);
    expect(a.profit).toBe(600);
    expect(a.netProfit).toBe(570);
    expect(a.paymentMethods.sort()).toEqual(
      [PaymentMethod.EFECTIVO, PaymentMethod.MERCADO_PAGO].sort(),
    );
    expect(b.channel).toBe('sin_canal');
    expect(b.fees).toBe(0);
    expect(b.netProfit).toBe(b.profit);
  });

  it('mostrador y feria: una fila por venta con su canal y comisión', () => {
    store.retailSales.push(
      {
        id: 'r-1',
        items: [],
        total: 500,
        fee: 25,
        method: PaymentMethod.MERCADO_PAGO,
        soldAt: noon('2026-11-03'),
        createdAt: noon('2026-11-03'),
      },
      {
        id: 'r-2',
        items: [],
        total: 700,
        fairId: 'fair-1',
        soldAt: noon('2026-11-03'),
        createdAt: noon('2026-11-03'),
      },
    );
    const { entries, stats } = service.getOverview('2026-11');
    const r1 = entries.find((e) => e.retailSaleId === 'r-1')!;
    const r2 = entries.find((e) => e.retailSaleId === 'r-2')!;
    expect(r1.channel).toBe('mostrador');
    expect(r1.fees).toBe(25);
    expect(r1.netProfit).toBe(r1.profit - 25);
    expect(r2.channel).toBe('feria');
    expect(r2.fairId).toBe('fair-1');
    expect(r2.fees).toBe(0);
    expect(stats.monthlyFees).toBe(25);
    expect(stats.monthlyNetProfit).toBe(stats.monthlyProfit - 25);
    expect(stats.monthlyRetailFees).toBe(25);
    expect(stats.monthlyOrdersFees).toBe(0);
    expect(
      stats.monthlyRetailNetProfit + stats.monthlyOrdersNetProfit,
    ).toBeCloseTo(stats.monthlyNetProfit, 2);
  });

  it('facturado, sin facturar y últimos 12 meses por fecha de factura', () => {
    store.orders.push(
      order({
        id: 'ord-1',
        invoice: {
          type: 'C',
          number: '0003-00000001',
          issuedAt: noon('2026-11-06'),
        },
      }),
      order({ id: 'ord-2', total: 2000 }),
      // Vendido en octubre 2025 (fuera del mes) pero facturado en noviembre 2026
      order({
        id: 'ord-old',
        total: 4000,
        deliveryHistory: [
          {
            id: 'd',
            deliveredAt: noon('2025-10-10'),
            items: [{ orderItemIndex: 0, quantity: 1 }],
          },
        ],
        invoice: {
          type: 'C',
          number: '0003-00000002',
          issuedAt: noon('2026-11-02'),
        },
      }),
      // Facturado hace más de 12 meses (2025-11-30 queda afuera de dic-2025..nov-2026)
      order({
        id: 'ord-out',
        total: 8000,
        deliveryHistory: [
          {
            id: 'd',
            deliveredAt: noon('2025-11-20'),
            items: [{ orderItemIndex: 0, quantity: 1 }],
          },
        ],
        invoice: {
          type: 'C',
          number: '0003-00000003',
          issuedAt: noon('2025-11-30'),
        },
      }),
    );
    store.retailSales.push({
      id: 'r-1',
      items: [],
      total: 300,
      soldAt: noon('2026-03-01'),
      createdAt: noon('2026-03-01'),
      invoice: {
        type: 'C',
        number: '0003-00000004',
        issuedAt: noon('2026-03-02'),
      },
    });
    const { stats } = service.getOverview('2026-11');
    expect(stats.invoicedCount).toBe(1);
    expect(stats.invoicedRevenue).toBe(1000);
    expect(stats.uninvoicedCount).toBe(1);
    expect(stats.uninvoicedRevenue).toBe(2000);
    // ord-1 (1000) + ord-old (4000) + r-1 (300); ord-out queda afuera
    expect(stats.last12MonthsInvoicedRevenue).toBe(5300);
    expect(stats.annualInvoiceCap).toBe(5000000);
  });

  it('el tope anual es null si no está cargado', () => {
    store.generalSettings.integrations.arca.annualCap = null;
    expect(service.getOverview().stats.annualInvoiceCap).toBeNull();
  });

  it('venta de mostrador guarda la comisión y valida 0 ≤ fee ≤ total', () => {
    const sale = service.createRetail({
      items: [{ productName: 'Taza', quantity: 1, unitPrice: 1000 }],
      method: PaymentMethod.MERCADO_PAGO,
      fee: 50.5,
    });
    expect(sale.fee).toBe(50.5);
    expect(() =>
      service.createRetail({
        items: [{ productName: 'Taza', quantity: 1, unitPrice: 1000 }],
        fee: 1001,
      }),
    ).toThrow('comisión');
    const noFee = service.createRetail({
      items: [{ productName: 'Taza', quantity: 1, unitPrice: 1000 }],
    });
    expect(noFee.fee).toBe(0);
  });

  it('editar la venta conserva la factura y la comisión', () => {
    const sale = service.createRetail({
      items: [{ productName: 'Taza', quantity: 1, unitPrice: 1000 }],
      fee: 40,
    });
    service.markRetailInvoice(sale.id, { number: '3-9' });
    const updated = service.updateRetail(sale.id, { notes: 'x' });
    expect(updated.fee).toBe(40);
    expect(updated.invoice?.number).toBe('0003-00000009');
  });

  it('factura de venta: repetida rechazada, se puede quitar y vale con feria cerrada', () => {
    store.fairs.push({
      id: 'fair-1',
      name: 'Plaza',
      status: 'closed',
    } as never);
    store.retailSales.push(
      {
        id: 'r-a',
        items: [],
        total: 10,
        fairId: 'fair-1',
        soldAt: noon('2026-11-03'),
        createdAt: noon('2026-11-03'),
      },
      {
        id: 'r-b',
        items: [],
        total: 10,
        soldAt: noon('2026-11-03'),
        createdAt: noon('2026-11-03'),
      },
    );
    const marked = service.markRetailInvoice('r-a', { number: '3-5' });
    expect(marked.invoice?.type).toBe('C');
    expect(() =>
      service.markRetailInvoice('r-b', { number: '0003-00000005' }),
    ).toThrow('ya está asignada');
    store.orders.push(
      order({
        id: 'ord-z',
        invoice: {
          type: 'C',
          number: '0003-00000077',
          issuedAt: noon('2026-11-06'),
        },
      }),
    );
    expect(() => service.markRetailInvoice('r-b', { number: '3-77' })).toThrow(
      'ya está asignada',
    );
    expect(service.removeRetailInvoice('r-a').invoice).toBeUndefined();
    expect(() => service.removeRetailInvoice('r-a')).toThrow(
      'no tiene factura',
    );
  });

  it('la caja descuenta la comisión de las ventas de mostrador', () => {
    store.retailSales.push({
      id: 'r-f',
      items: [],
      total: 1000,
      fee: 60,
      soldAt: noon('2026-11-03'),
      createdAt: noon('2026-11-03'),
    });
    expect(service.getCollectedIncome()).toBe(940);
  });
});
