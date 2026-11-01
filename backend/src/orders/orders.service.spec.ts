import {
  CustomerType,
  OrderStatus,
  PriceType,
  ProductType,
  SalesChannel,
  ServiceType,
} from '../common/enums';
import { OrderTasksService } from '../print-jobs/order-tasks.service';
import { PrintJobsService } from '../print-jobs/print-jobs.service';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import {
  CustomerRepository,
  OrderRepository,
  ProductRepository,
} from '../store/repositories';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { OrdersService } from './orders.service';

function futureDueDate(daysAhead = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return `${date.toISOString().slice(0, 10)}T18:00:00.000Z`;
}

describe('OrdersService.getOverview', () => {
  let store: StoreService;
  let service: OrdersService;

  beforeEach(() => {
    store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-1',
      name: 'Cliente',
      email: 'a@test.com',
      phone: '123',
      type: CustomerType.PARTICULAR,
      createdAt: '2026-07-01T10:00:00.000Z',
    });
    state.products.push({
      id: 'prod-1',
      name: 'Pieza',
      type: ProductType.FDM,
      images: [],
      attachments: [],
      updatedAt: '2026-07-01T10:00:00.000Z',
      price: 100,
      cost: 50,
      profit: 50,
      categoryIds: [],
      size: '10 cm',
      published: true,
      components: [],
      assemblyTimeHours: 0,
      includesPieces: false,
      grams: 10,
      printTimeHours: 1,
      workTimeHours: 0,
      stock: 2,
    });
    state.orders.push({
      id: 'ord-1',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [ProductType.FDM as never],
      items: [],
      status: OrderStatus.PENDIENTE,
      total: 0,
      createdAt: '2026-07-01T10:00:00.000Z',
      dueDate: '2026-07-10T18:00:00.000Z',
    });
    store.applyState(state);
    store.indexOrder(state.orders[0]);

    const orderTasks = new OrderTasksService(store);
    const printJobs = new PrintJobsService(store, orderTasks);
    const orders = new OrderRepository(store);
    const customers = new CustomerRepository(store);
    const products = new ProductRepository(store);
    service = new OrdersService(
      orders,
      customers,
      products,
      orderTasks,
      printJobs,
      {} as CostCalculatorService,
      store,
    );
  });

  it('devuelve pedido y tareas en una sola respuesta', () => {
    const overview = service.getOverview('ord-1');

    expect(overview.order.id).toBe('ord-1');
    expect(overview).not.toHaveProperty('customers');
    expect(overview).not.toHaveProperty('products');
    expect(Array.isArray(overview.tasks)).toBe(true);
  });

  it('registra entrega parcial y descuenta solo stock reservado', () => {
    const order = store.orders[0];
    order.items = [
      {
        serviceType: ProductType.FDM as never,
        productId: 'prod-1',
        productName: 'Pieza',
        quantity: 3,
        unitPrice: 100,
        reservedQuantity: 2,
        producedQuantity: 1,
        deliveredQuantity: 0,
        productionRequiredQuantity: 1,
        deliveredFromProductionQuantity: 0,
      },
    ];

    service.deliver(order.id, [{ orderItemIndex: 0, quantity: 1 }]);

    expect(order.items[0].deliveredQuantity).toBe(1);
    expect(order.items[0].reservedQuantity).toBe(1);
    expect(store.products[0].stock).toBe(1);
    expect(order.status).toBe(OrderStatus.PARCIALMENTE_ENTREGADO);
    expect(order.deliveryHistory).toHaveLength(1);
  });

  it('rechaza una fecha de entrega de hoy o anterior', () => {
    const now = new Date();
    const day = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    expect(() =>
      service.create({
        customerId: 'cust-1',
        items: [],
        dueDate: `${day}T18:00:00.000Z`,
      }),
    ).toThrow(/posterior a hoy/);
  });

  it('mantiene el total hasta actualizar el precio del producto', () => {
    const order = store.orders[0];
    order.items = [
      {
        serviceType: ProductType.FDM as never,
        productId: 'prod-1',
        productName: 'Pieza',
        quantity: 2,
        unitPrice: 80,
      },
    ];
    order.total = 160;
    store.products[0].price = 100;

    const kept = service.keepCatalogPrices(order.id);
    expect(kept.total).toBe(160);
    expect(kept.items[0].unitPrice).toBe(80);
    expect(service.getOverview(order.id).priceNotices).toEqual([]);

    store.products[0].price = 120;
    const applied = service.applyCatalogPrices(order.id);
    expect(applied.items[0].unitPrice).toBe(120);
    expect(applied.total).toBe(240);
  });

  it('registra pagos sin superar el saldo pendiente', () => {
    const order = store.orders[0];
    order.total = 100;

    service.addPayment(order.id, { amount: 40, deposit: true });
    expect(order.payments).toHaveLength(1);
    expect(order.payments![0].deposit).toBe(true);

    expect(() => service.addPayment(order.id, { amount: 60.01 })).toThrow(
      /supera el saldo pendiente/,
    );
    service.addPayment(order.id, { amount: 60 });
    expect(order.payments).toHaveLength(2);
  });

  it('no permite cobrar un pedido cancelado', () => {
    const order = store.orders[0];
    order.total = 100;
    service.updateStatus(order.id, OrderStatus.CANCELADO);

    expect(() => service.addPayment(order.id, { amount: 10 })).toThrow(
      /cancelado/,
    );
  });

  it('solo permite cancelar o reabrir manualmente (§13)', () => {
    const order = store.orders[0];

    expect(() => service.updateStatus(order.id, OrderStatus.TERMINADO)).toThrow(
      /cancelar o reabrir/,
    );

    service.updateStatus(order.id, OrderStatus.CANCELADO);
    expect(order.status).toBe(OrderStatus.CANCELADO);

    service.updateStatus(order.id, OrderStatus.PENDIENTE);
    expect(order.status).toBe(OrderStatus.PENDIENTE);
    expect(order.statusHistory?.map((entry) => entry.toStatus)).toEqual([
      OrderStatus.CANCELADO,
      OrderStatus.PENDIENTE,
    ]);
  });
});

describe('OrdersService precio mayorista (§10)', () => {
  let store: StoreService;
  let service: OrdersService;

  beforeEach(() => {
    store = new StoreService();
    const state = createEmptyState();
    state.customers.push(
      {
        id: 'cust-rev',
        name: 'Revendedor',
        email: 'rev@test.com',
        phone: '111',
        type: CustomerType.REVENDEDOR,
        wholesaleMinimum: 5000,
        createdAt: '2026-07-01T10:00:00.000Z',
      },
      {
        id: 'cust-rev-sin-min',
        name: 'Revendedor sin mínimo',
        email: 'rev2@test.com',
        phone: '222',
        type: CustomerType.REVENDEDOR,
        createdAt: '2026-07-01T10:00:00.000Z',
      },
      {
        id: 'cust-part',
        name: 'Particular',
        email: 'p@test.com',
        phone: '333',
        type: CustomerType.PARTICULAR,
        createdAt: '2026-07-01T10:00:00.000Z',
      },
    );
    state.products.push({
      id: 'prod-1',
      name: 'Pieza',
      type: ProductType.FDM,
      images: [],
      attachments: [],
      updatedAt: '2026-07-01T10:00:00.000Z',
      price: 1000,
      cost: 400,
      profit: 600,
      categoryIds: [],
      size: '10 cm',
      published: true,
      components: [],
      assemblyTimeHours: 0,
      includesPieces: false,
      grams: 10,
      printTimeHours: 1,
      workTimeHours: 0,
      stock: 10,
    });
    store.applyState(state);

    const orderTasks = new OrderTasksService(store);
    const printJobs = new PrintJobsService(store, orderTasks);
    service = new OrdersService(
      new OrderRepository(store),
      new CustomerRepository(store),
      new ProductRepository(store),
      orderTasks,
      printJobs,
      new CostCalculatorService(store),
      store,
    );
  });

  it('pedido de revendedor sale mayorista por defecto', () => {
    const order = service.create({
      customerId: 'cust-rev-sin-min',
      dueDate: futureDueDate(),
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
    });

    expect(order.priceType).toBe(PriceType.MAYORISTA);
    expect(order.wholesaleApplied).toBe(true);
    expect(order.items[0].listUnitPrice).toBe(1000);
    expect(order.items[0].unitPrice).toBe(800);
    expect(order.total).toBe(800);
  });

  it('mínimo no alcanzado → cobra precio de lista', () => {
    const order = service.create({
      customerId: 'cust-rev',
      dueDate: futureDueDate(),
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
    });

    expect(order.priceType).toBe(PriceType.MAYORISTA);
    expect(order.wholesaleApplied).toBe(false);
    expect(order.items[0].listUnitPrice).toBeUndefined();
    expect(order.items[0].unitPrice).toBe(1000);
    expect(order.total).toBe(1000);
  });

  it('diseño no recibe descuento mayorista', () => {
    const order = service.create({
      customerId: 'cust-rev-sin-min',
      dueDate: futureDueDate(),
      items: [
        {
          serviceType: ServiceType.DISENO_GRAFICO,
          productName: 'Logo',
          quantity: 1,
          unitPrice: 5000,
          designUnitPrice: 5000,
          chargeMode: 'fixed',
        },
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
    });

    expect(order.wholesaleApplied).toBe(true);
    expect(order.items[0].unitPrice).toBe(5000);
    expect(order.items[0].listUnitPrice).toBeUndefined();
    expect(order.items[1].unitPrice).toBe(800);
    expect(order.items[1].listUnitPrice).toBe(1000);
  });

  it('editar sin reenviar ítems no descuenta dos veces', () => {
    const created = service.create({
      customerId: 'cust-rev-sin-min',
      dueDate: futureDueDate(),
      salesChannel: SalesChannel.WHATSAPP,
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 2,
          unitPrice: 1000,
        },
      ],
    });

    expect(created.items[0].unitPrice).toBe(800);
    expect(created.total).toBe(1600);

    const updated = service.update(created.id, {
      notes: 'solo nota',
    });

    expect(updated.items[0].unitPrice).toBe(800);
    expect(updated.items[0].listUnitPrice).toBe(1000);
    expect(updated.total).toBe(1600);
    expect(updated.salesChannel).toBe(SalesChannel.WHATSAPP);
  });

  it('permite mayorista aunque el cliente no sea revendedor', () => {
    const order = service.create({
      customerId: 'cust-part',
      priceType: PriceType.MAYORISTA,
      dueDate: futureDueDate(),
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
    });

    expect(order.priceType).toBe(PriceType.MAYORISTA);
    expect(order.wholesaleApplied).toBe(true);
    expect(order.items[0].unitPrice).toBe(800);
  });
});
