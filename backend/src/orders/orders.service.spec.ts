import {
  CustomerType,
  FilamentType,
  OrderStatus,
  PaymentMethod,
  PriceType,
  PrintJobStatus,
  ProductType,
  SalesChannel,
  ServiceType,
  SupplyCategory,
  TaskType,
  TreasuryAccount,
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
import { paidCents } from '../common/utils/money.util';
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

  it('devuelve el presupuesto de origen si algún quote guarda ese orderId', () => {
    expect(service.getOverview('ord-1').sourceQuote).toBeUndefined();
    store.quotes.push({ id: 'quo-7', orderId: 'ord-1' } as never);
    expect(service.getOverview('ord-1').sourceQuote).toEqual({ id: 'quo-7' });
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

  it('anula un pago con motivo y libera el saldo (U-16)', () => {
    const order = store.orders[0];
    order.total = 100;
    service.addPayment(order.id, { amount: 100 });
    const id = order.payments![0].id;

    expect(() => service.voidPayment(order.id, id, '  ')).toThrow(/motivo/);
    expect(() => service.voidPayment(order.id, 'nope', 'error')).toThrow(
      /no encontrado/,
    );
    service.voidPayment(order.id, id, 'monto mal cargado');
    expect(order.payments![0].voidedAt).toBeTruthy();
    expect(order.payments![0].voidReason).toBe('monto mal cargado');
    expect(() => service.voidPayment(order.id, id, 'otra vez')).toThrow(
      /ya está anulado/,
    );
    expect(paidCents(order)).toBe(0);
    service.addPayment(order.id, { amount: 100 });
    expect(order.payments).toHaveLength(2);
  });

  it('rechaza pagos con monto cero o negativo (A-1)', () => {
    const order = store.orders[0];
    order.total = 100;
    expect(() => service.addPayment(order.id, { amount: -500 })).toThrow(
      /mayor a cero/,
    );
    expect(() => service.addPayment(order.id, { amount: 0 })).toThrow(
      /mayor a cero/,
    );
    expect(order.payments ?? []).toHaveLength(0);
  });

  it('no deja bajar el total por debajo de lo cobrado y registra el descuento (A-2, M-6)', () => {
    const order = store.orders[0];
    order.total = 100;
    order.items = [{ ...order.items[0], quantity: 1, unitPrice: 100 }];
    service.addPayment(order.id, { amount: 80 });

    expect(() => service.update(order.id, { discountPercent: 50 })).toThrow(
      /Ya se cobraron \$80; el total no puede ser menor/,
    );

    const updated = service.update(order.id, { discountPercent: 10 });
    expect(updated.total).toBe(90);
    const entry = updated.priceHistory!.find(
      (e) => e.trigger === 'discount_change',
    );
    expect(entry?.previousDiscountLabel).toBe('Sin descuento');
    expect(entry?.newDiscountLabel).toBe('10 %');
    expect(entry?.previousOrderTotal).toBe(100);
    expect(entry?.newOrderTotal).toBe(90);
  });

  it('registra medio, cuenta y comisión; rechaza comisión inválida', () => {
    const order = store.orders[0];
    order.total = 100;
    order.payments = [];

    const withFee = service.addPayment(order.id, {
      amount: 50,
      method: PaymentMethod.MERCADO_PAGO,
      fee: 5,
    });
    expect(withFee.payments![0]).toMatchObject({
      amount: 50,
      method: PaymentMethod.MERCADO_PAGO,
      account: TreasuryAccount.MERCADO_PAGO,
      fee: 5,
    });

    expect(() =>
      service.addPayment(order.id, {
        amount: 20,
        fee: 20,
      }),
    ).toThrow(/comisión tiene que ser menor que el monto/);

    const cash = service.addPayment(order.id, { amount: 20 });
    expect(cash.payments![1]).toMatchObject({
      method: PaymentMethod.EFECTIVO,
      account: TreasuryAccount.CAJA,
      fee: 0,
    });
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

  it('entrega insumo suelto vinculado y descuenta stock', () => {
    store.supplies.push({
      id: 'sup-polimero',
      name: 'Polímero',
      category: SupplyCategory.GENERAL,
      unit: 'u',
      quantity: 10,
      minStock: 0,
      unitPrice: 800,
      priceFromSettings: false,
      updatedAt: '2026-07-01T10:00:00.000Z',
    });
    const order = store.orders[0];
    order.items = [
      {
        serviceType: ServiceType.INSUMO,
        productName: 'Polímero',
        quantity: 3,
        unitPrice: 800,
        unitCost: 800,
        deliveredQuantity: 0,
        estampadoSupplies: [
          { id: 'l1', supplyId: 'sup-polimero', quantity: 3 },
        ],
      },
    ];
    order.total = 2400;

    service.deliver(order.id, [{ orderItemIndex: 0, quantity: 3 }]);

    expect(order.items[0].deliveredQuantity).toBe(3);
    expect(order.status).toBe(OrderStatus.ENTREGADO);
    expect(store.supplies[0].quantity).toBe(7);
    expect(store.supplyMovements).toEqual([
      expect.objectContaining({
        supplyId: 'sup-polimero',
        delta: -3,
        reason: 'delivery',
      }),
    ]);
  });

  it('entrega insumo suelto sin vínculo sin tocar stock', () => {
    store.supplies.push({
      id: 'sup-otro',
      name: 'Otro',
      category: SupplyCategory.GENERAL,
      unit: 'u',
      quantity: 5,
      minStock: 0,
      unitPrice: 100,
      priceFromSettings: false,
      updatedAt: '2026-07-01T10:00:00.000Z',
    });
    const order = store.orders[0];
    order.items = [
      {
        serviceType: ServiceType.INSUMO,
        productName: 'Cinta texto libre',
        quantity: 2,
        unitPrice: 50,
        unitCost: 50,
        deliveredQuantity: 0,
      },
    ];
    order.total = 100;

    service.deliver(order.id, [{ orderItemIndex: 0, quantity: 2 }]);

    expect(order.items[0].deliveredQuantity).toBe(2);
    expect(order.status).toBe(OrderStatus.ENTREGADO);
    expect(store.supplies[0].quantity).toBe(5);
    expect(store.supplyMovements).toHaveLength(0);
  });

  it('deliverAll entrega todo aunque haya tarea sin terminar', () => {
    const order = store.orders[0];
    order.items = [
      {
        serviceType: ServiceType.IMPRESION_3D,
        productId: 'prod-1',
        productName: 'Pieza',
        quantity: 2,
        unitPrice: 100,
        reservedQuantity: 0,
        producedQuantity: 0,
        deliveredQuantity: 0,
        productionRequiredQuantity: 2,
        deliveredFromProductionQuantity: 0,
      },
      {
        serviceType: ServiceType.INSUMO,
        productName: 'Polímero',
        quantity: 1,
        unitPrice: 800,
        unitCost: 800,
        deliveredQuantity: 0,
        estampadoSupplies: [
          { id: 'l1', supplyId: 'sup-polimero', quantity: 1 },
        ],
      },
    ];
    order.total = 1000;
    store.supplies.push({
      id: 'sup-polimero',
      name: 'Polímero',
      category: SupplyCategory.GENERAL,
      unit: 'u',
      quantity: 4,
      minStock: 0,
      unitPrice: 800,
      priceFromSettings: false,
      updatedAt: '2026-07-01T10:00:00.000Z',
    });
    store.printJobs.push({
      id: 'job-open',
      orderId: order.id,
      orderItemIndex: 0,
      customerName: order.customerName,
      productName: 'Hacer 2 Pieza',
      type: ServiceType.IMPRESION_3D,
      taskType: TaskType.PRODUCTION,
      quantity: 2,
      status: PrintJobStatus.POR_HACER,
      active: true,
      archived: false,
      priority: 1,
      machine: 'FDM',
      estimatedHours: 1,
      dueDate: order.dueDate,
    });

    service.deliverAll(order.id);

    expect(order.items[0].deliveredQuantity).toBe(2);
    expect(order.items[1].deliveredQuantity).toBe(1);
    expect(order.status).toBe(OrderStatus.ENTREGADO);
    expect(store.printJobs[0].archived).toBe(true);
    expect(store.supplies[0].quantity).toBe(3);
    expect(order.deliveryHistory).toHaveLength(1);
  });

  function setupFilamentProduct(stock: number) {
    store.products[0] = {
      ...store.products[0],
      stock,
      filamentType: FilamentType.PLA,
      grams: 100,
    } as (typeof store.products)[number];
    store.supplies.push({
      id: 'sup-pla',
      name: 'PLA',
      category: SupplyCategory.FDM,
      unit: 'kg',
      quantity: 1,
      minStock: 0,
      unitPrice: 10000,
      priceFromSettings: false,
      filamentType: FilamentType.PLA,
      updatedAt: '2026-07-01T10:00:00.000Z',
    });
    const order = store.orders[0];
    order.items = [
      {
        serviceType: ServiceType.IMPRESION_3D,
        productId: 'prod-1',
        productName: 'Pieza',
        quantity: 2,
        unitPrice: 100,
        reservedQuantity: 0,
        producedQuantity: 0,
        deliveredQuantity: 0,
        productionRequiredQuantity: 0,
        deliveredFromProductionQuantity: 0,
      },
    ];
    order.total = 200;
    return order;
  }

  it('entrega sin producción y sin reserva descuenta stock terminado y no insumos', () => {
    const order = setupFilamentProduct(2);

    service.deliverAll(order.id);

    expect(store.products[0].stock).toBe(0);
    expect(store.supplies[0].quantity).toBe(1);
  });

  it('entrega sin stock descuenta los insumos de la receta', () => {
    const order = setupFilamentProduct(1);

    service.deliverAll(order.id);

    expect(store.products[0].stock).toBe(0);
    // 1 unidad sin stock = 100 g de PLA
    expect(store.supplies[0].quantity).toBeCloseTo(0.9, 5);
  });

  it('entrega con tarea de producción abierta la da por hecha y descuenta insumos una sola vez', () => {
    const order = setupFilamentProduct(0);
    order.items[0].productionRequiredQuantity = 2;
    store.printJobs.push({
      id: 'job-open',
      orderId: order.id,
      orderItemIndex: 0,
      customerName: order.customerName,
      productName: 'Hacer 2 Pieza',
      productId: 'prod-1',
      type: ServiceType.IMPRESION_3D,
      taskType: TaskType.PRODUCTION,
      quantity: 2,
      status: PrintJobStatus.POR_HACER,
      active: true,
      archived: false,
      priority: 1,
      machine: 'FDM',
      estimatedHours: 1,
      dueDate: order.dueDate,
    });

    service.deliverAll(order.id);

    const job = store.printJobs[0];
    expect(job.status).toBe(PrintJobStatus.TERMINADO);
    expect(job.archived).toBe(true);
    expect(job.consumedAt).toBeTruthy();
    // 2 un. × 100 g = 0.2 kg, una sola vez
    expect(store.supplies[0].quantity).toBeCloseTo(0.8, 5);
    expect(store.supplyMovements).toHaveLength(1);
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

  it('un pedido mayorista no avisa cambio de precio si el catálogo no cambió', () => {
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

    expect(service.getOverview(order.id).priceNotices).toEqual([]);

    // Si el catálogo sube, el aviso compara lista contra lista.
    store.products[0].price = 1200;
    expect(service.getOverview(order.id).priceNotices).toEqual([
      expect.objectContaining({
        agreedUnitPrice: 1000,
        currentUnitPrice: 1200,
      }),
    ]);
  });
});

describe('OrdersService.update conserva el cumplimiento', () => {
  it('un PATCH con líneas viejas no pisa lo producido', () => {
    const store = new StoreService();
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
      stock: 0,
    });
    state.orders.push({
      id: 'ord-1',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 100,
          producedQuantity: 1,
          productionRequiredQuantity: 0,
        },
      ],
      status: OrderStatus.PENDIENTE,
      total: 100,
      createdAt: '2026-07-01T10:00:00.000Z',
      dueDate: '2026-07-10T18:00:00.000Z',
    });
    store.applyState(state);
    store.indexOrder(state.orders[0]);
    const orderTasks = new OrderTasksService(store);
    const service = new OrdersService(
      new OrderRepository(store),
      new CustomerRepository(store),
      new ProductRepository(store),
      orderTasks,
      new PrintJobsService(store, orderTasks),
      {
        resolveOrderUnitPrice: (_s: unknown, _p: unknown, price: number) =>
          price,
      } as unknown as CostCalculatorService,
      store,
    );

    const updated = service.update('ord-1', {
      dueDate: '2099-01-01T12:00:00.000Z',
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 100,
        },
      ],
    });

    expect(updated.items[0].producedQuantity).toBe(1);
    expect(updated.items[0].productionRequiredQuantity).toBe(0);
  });
});
