import {
  CustomerType,
  FilamentType,
  PriceType,
  ProductType,
  QuoteStatus,
  SalesChannel,
  ServiceType,
  TaskType,
} from '../common/enums';
import { OrdersService } from '../orders/orders.service';
import { OrderTasksService } from '../print-jobs/order-tasks.service';
import { PrintJobsService } from '../print-jobs/print-jobs.service';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import {
  CustomerRepository,
  OrderRepository,
  ProductRepository,
  QuoteRepository,
} from '../store/repositories';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { QuotesService } from './quotes.service';

function buildQuotesService(store: StoreService): QuotesService {
  const orderTasks = new OrderTasksService(store);
  const printJobs = new PrintJobsService(store, orderTasks);
  const orders = new OrdersService(
    new OrderRepository(store),
    new CustomerRepository(store),
    new ProductRepository(store),
    orderTasks,
    printJobs,
    new CostCalculatorService(store),
    store,
  );
  return new QuotesService(
    new QuoteRepository(store),
    new CustomerRepository(store),
    orders,
    new ProductRepository(store),
    store,
    { recordChange: jest.fn() } as unknown as StoreChangeService,
  );
}

describe('QuotesService producto nuevo', () => {
  it('al aceptar crea el producto no publicado y lo incorpora al pedido', () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-1',
      name: 'Cliente',
      email: 'a@test.com',
      phone: '123',
      type: CustomerType.PARTICULAR,
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    state.quotes.push({
      id: 'qte-1',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Mate nuevo',
          quantity: 1,
          unitPrice: 2500,
          grams: 40,
          printTimeHours: 2,
          filamentType: FilamentType.PLA,
        },
      ],
      status: QuoteStatus.ACEPTADO,
      total: 2500,
      quotedAt: '2026-10-21T12:00:00.000Z',
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    store.applyState(state);

    const service = buildQuotesService(store);
    const order = service.createOrderFromQuote('qte-1', 'uid-acepta');
    expect(order.responsibleUserId).toBe('uid-acepta');
    const productId = order.items[0]?.productId;

    expect(productId).toBeTruthy();
    const product = store.getProductById(productId!);
    expect(product?.published).toBe(false);
    expect(product?.name).toBe('Mate nuevo');
    expect(product?.categoryIds).toEqual([]);
    expect(
      product && 'brandId' in product ? product.brandId : undefined,
    ).toBeUndefined();
    expect(order.items[0]?.unitPrice).toBe(2500);
    expect(store.getQuoteById('qte-1')?.items[0]?.productId).toBe(productId);
  });
});

describe('QuotesService adjuntos', () => {
  it('presupuesto → pedido copia los adjuntos con las mismas URLs', () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-1',
      name: 'Cliente',
      email: 'c@test.com',
      phone: '123',
      type: CustomerType.PARTICULAR,
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    const attachments = [
      {
        id: 'att-1',
        name: 'logo.pdf',
        url: 'https://example.com/logo.pdf',
        mimeType: 'application/pdf',
        size: 100,
      },
    ];
    state.quotes.push({
      id: 'qte-att',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Mate',
          quantity: 1,
          unitPrice: 2500,
          grams: 40,
          printTimeHours: 2,
          filamentType: FilamentType.PLA,
        },
      ],
      status: QuoteStatus.ACEPTADO,
      total: 2500,
      attachments,
      quotedAt: '2026-10-21T12:00:00.000Z',
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    store.applyState(state);

    const order = buildQuotesService(store).createOrderFromQuote('qte-att');
    expect(order.attachments).toEqual(attachments);
  });
});

describe('QuotesService precio mayorista (§10)', () => {
  it('presupuesto aceptado → pedido conserva precios y canal', () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-rev',
      name: 'Revendedor',
      email: 'rev@test.com',
      phone: '111',
      type: CustomerType.REVENDEDOR,
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    state.products.push({
      id: 'prod-1',
      name: 'Pieza',
      type: ProductType.FDM,
      images: [],
      attachments: [],
      updatedAt: '2026-10-21T12:00:00.000Z',
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
      stock: 5,
    });
    store.applyState(state);

    const service = buildQuotesService(store);
    const quote = service.create({
      customerId: 'cust-rev',
      salesChannel: SalesChannel.INSTAGRAM,
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

    expect(quote.priceType).toBe(PriceType.MAYORISTA);
    expect(quote.wholesaleApplied).toBe(true);
    expect(quote.items[0].unitPrice).toBe(800);
    expect(quote.items[0].listUnitPrice).toBe(1000);
    expect(quote.salesChannel).toBe(SalesChannel.INSTAGRAM);
    expect(quote.total).toBe(1600);

    // Cambiar Ajustes después de cotizar no mueve los precios aceptados (§16.2).
    store.generalSettings.wholesaleDiscount = {
      ...store.generalSettings.wholesaleDiscount,
      percent: 50,
    };
    service.updateStatus(quote.id, QuoteStatus.ACEPTADO);
    const order = service.createOrderFromQuote(quote.id);

    expect(order.priceType).toBe(PriceType.MAYORISTA);
    expect(order.wholesaleApplied).toBe(true);
    expect(order.salesChannel).toBe(SalesChannel.INSTAGRAM);
    expect(order.items[0].unitPrice).toBe(800);
    expect(order.items[0].listUnitPrice).toBe(1000);
    expect(order.total).toBe(1600);
  });

  it('editar presupuesto sin reenviar ítems no descuenta dos veces', () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-rev',
      name: 'Revendedor',
      email: 'rev@test.com',
      phone: '111',
      type: CustomerType.REVENDEDOR,
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    state.products.push({
      id: 'prod-1',
      name: 'Pieza',
      type: ProductType.FDM,
      images: [],
      attachments: [],
      updatedAt: '2026-10-21T12:00:00.000Z',
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
      stock: 5,
    });
    store.applyState(state);

    const service = buildQuotesService(store);
    const quote = service.create({
      customerId: 'cust-rev',
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

    const updated = service.update(quote.id, {
      description: '<p>nota</p>',
    });

    expect(updated.items[0].unitPrice).toBe(800);
    expect(updated.items[0].listUnitPrice).toBe(1000);
    expect(updated.total).toBe(800);
  });
});

describe('QuotesService borrador sin líneas', () => {
  function setup() {
    const store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-1',
      name: 'Cliente',
      email: 'a@test.com',
      phone: '123',
      type: CustomerType.PARTICULAR,
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    store.applyState(state);
    return buildQuotesService(store);
  }

  const line = {
    serviceType: ServiceType.IMPRESION_3D,
    productName: 'Mate',
    quantity: 1,
    unitPrice: 2500,
    grams: 40,
    printTimeHours: 2,
    filamentType: FilamentType.PLA,
  };

  it('borrador vacío con cliente se guarda', () => {
    const quote = setup().create({ customerId: 'cust-1', items: [] });
    expect(quote.status).toBe(QuoteStatus.BORRADOR);
    expect(quote.items).toEqual([]);
    expect(quote.total).toBe(0);
  });

  it('borrador sin cliente ni descripción se rechaza', () => {
    expect(() => setup().create({ items: [] })).toThrow(
      'El borrador necesita al menos un cliente o una descripción',
    );
  });

  it('borrador con descripción sin cliente se guarda', () => {
    const quote = setup().create({ items: [], description: '<p>Nota</p>' });
    expect(quote.customerId).toBeNull();
    expect(quote.items).toEqual([]);
  });

  it('crear Enviado sin líneas se rechaza', () => {
    expect(() =>
      setup().create({
        customerId: 'cust-1',
        items: [],
        status: QuoteStatus.ENVIADO,
      }),
    ).toThrow('El presupuesto necesita al menos una línea para enviarse');
  });

  it('updateStatus a Enviado o Aceptado sin líneas se rechaza', () => {
    const service = setup();
    const quote = service.create({ customerId: 'cust-1', items: [] });
    expect(() => service.updateStatus(quote.id, QuoteStatus.ENVIADO)).toThrow(
      'al menos una línea',
    );
    expect(() => service.updateStatus(quote.id, QuoteStatus.ACEPTADO)).toThrow(
      'al menos una línea',
    );
  });

  it('editar un Enviado dejándolo sin líneas se rechaza', () => {
    const service = setup();
    const quote = service.create({
      customerId: 'cust-1',
      items: [line],
      status: QuoteStatus.ENVIADO,
    });
    expect(quote.status).toBe(QuoteStatus.ENVIADO);
    expect(() => service.update(quote.id, { items: [] })).toThrow(
      'al menos una línea',
    );
  });
});

describe('QuotesService tareas de producción', () => {
  it('presupuesto aceptado → pedido con tarea «Hacer…» y Preparar con las unidades', () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-1',
      name: 'Cliente',
      email: 'a@test.com',
      phone: '123',
      type: CustomerType.PARTICULAR,
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    state.quotes.push({
      id: 'qte-1',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Mate nuevo',
          quantity: 2,
          unitPrice: 2500,
          grams: 40,
          printTimeHours: 2,
          filamentType: FilamentType.PLA,
        },
      ],
      status: QuoteStatus.ACEPTADO,
      total: 5000,
      quotedAt: '2026-10-21T12:00:00.000Z',
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    store.applyState(state);

    const order = buildQuotesService(store).createOrderFromQuote('qte-1');
    const jobs = store.printJobs.filter((job) => job.orderId === order.id);
    const production = jobs.find((job) => job.taskType === TaskType.PRODUCTION);
    expect(production?.productName).toBe('Hacer 2 Mate nuevo');
    expect(production?.quantity).toBe(2);
    const prepare = jobs.find((job) => job.taskType === TaskType.PREPARE_ORDER);
    expect(prepare?.quantity).toBe(2);
  });
});

describe('QuotesService pedido mixto entregado (MA-4)', () => {
  it('genera las tareas de impresión y, al entregar todo, quedan terminadas y archivadas', () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-1',
      name: 'Cliente',
      email: 'a@test.com',
      phone: '123',
      type: CustomerType.PARTICULAR,
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    state.quotes.push({
      id: 'qte-1',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [ServiceType.IMPRESION_3D, ServiceType.DISENO_GRAFICO],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Soporte nuevo',
          quantity: 1,
          unitPrice: 2500,
          grams: 50,
          printTimeHours: 2,
          filamentType: FilamentType.PLA,
        },
        {
          serviceType: ServiceType.DISENO_GRAFICO,
          productName: 'Logo',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
      status: QuoteStatus.ACEPTADO,
      total: 3500,
      quotedAt: '2026-10-21T12:00:00.000Z',
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    store.applyState(state);
    const orderTasks = new OrderTasksService(store);
    const orders = new OrdersService(
      new OrderRepository(store),
      new CustomerRepository(store),
      new ProductRepository(store),
      orderTasks,
      new PrintJobsService(store, orderTasks),
      new CostCalculatorService(store),
      store,
    );
    const quotes = new QuotesService(
      new QuoteRepository(store),
      new CustomerRepository(store),
      orders,
      new ProductRepository(store),
      store,
      { recordChange: jest.fn() } as unknown as StoreChangeService,
    );

    const order = quotes.createOrderFromQuote('qte-1');
    const jobs = () =>
      store.printJobs.filter((job) => job.orderId === order.id);
    expect(jobs().some((job) => job.taskType === TaskType.PRODUCTION)).toBe(
      true,
    );

    orders.deliverAll(order.id);
    expect(jobs().length).toBeGreaterThanOrEqual(3);
    for (const job of jobs()) {
      expect(job.archived).toBe(true);
      expect(job.active).toBe(false);
      expect(job.status).toBe('terminado');
    }
  });
});

describe('QuotesService costo cargado en servicios de terceros', () => {
  it('conserva el costo al guardar, reeditar y convertir en pedido', () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-1',
      name: 'Cliente',
      email: 'a@test.com',
      phone: '123',
      type: CustomerType.PARTICULAR,
      createdAt: '2026-10-21T12:00:00.000Z',
    });
    store.applyState(state);
    const service = buildQuotesService(store);
    const resolver = new CostCalculatorService(store);

    const quote = service.create({
      customerId: 'cust-1',
      status: QuoteStatus.ENVIADO,
      items: [
        {
          serviceType: ServiceType.SERVICIO_TERCERO,
          productName: 'QA2-envio',
          quantity: 1,
          unitPrice: 2000,
          unitCost: 300,
        },
      ],
    });
    expect(quote.items[0].unitCost).toBe(300);
    expect(service.findOne(quote.id).items[0].unitCost).toBe(300);
    expect(resolver.resolveOrderItemUnitCost(quote.items[0])).toBe(300);

    const edited = service.update(quote.id, { description: 'nota' });
    expect(edited.items[0].unitCost).toBe(300);

    service.updateStatus(quote.id, QuoteStatus.ACEPTADO);
    const order = service.createOrderFromQuote(quote.id);
    expect(order.items[0].unitCost).toBe(300);
  });
});

describe('QuoteRepository.nextId', () => {
  it('un presupuesto nuevo usa quo- y no choca con ids qte- ni quo- existentes', () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.quotes.push(
      { id: 'qte-5' } as never,
      { id: 'quo-3' } as never,
      { id: 'qte-9' } as never,
    );
    store.applyState(state);
    const id = new QuoteRepository(store).nextId();
    expect(id).toBe('quo-10');
    expect(id.startsWith('quo-')).toBe(true);
  });
});

describe('QuotesService presupuesto vencido', () => {
  function setup(quotedAt: string) {
    const store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-1',
      name: 'Cliente',
      email: 'a@test.com',
      phone: '123',
      type: CustomerType.PARTICULAR,
      createdAt: '2026-01-01T12:00:00.000Z',
    });
    state.quotes.push({
      id: 'qte-v',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Mate',
          quantity: 1,
          unitPrice: 2500,
          grams: 40,
          printTimeHours: 2,
          filamentType: FilamentType.PLA,
        },
      ],
      status: QuoteStatus.ENVIADO,
      total: 2500,
      quotedAt,
      createdAt: quotedAt,
    });
    store.applyState(state);
    return buildQuotesService(store);
  }

  it('rechaza aceptar un presupuesto vencido', () => {
    const service = setup('2020-01-01T12:00:00.000Z');
    expect(() => service.updateStatus('qte-v', QuoteStatus.ACEPTADO)).toThrow(
      'vencido',
    );
  });

  it('renovar extiende la validez y permite aceptar', () => {
    const service = setup('2020-01-01T12:00:00.000Z');
    const renewed = service.renew('qte-v');
    expect(new Date(renewed.quotedAt).getUTCFullYear()).toBeGreaterThan(2020);
    expect(() =>
      service.updateStatus('qte-v', QuoteStatus.ACEPTADO),
    ).not.toThrow();
  });
});
