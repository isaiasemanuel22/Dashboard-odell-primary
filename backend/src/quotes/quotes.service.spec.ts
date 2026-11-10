import {
  CustomerType,
  FilamentType,
  PriceType,
  ProductType,
  QuoteStatus,
  SalesChannel,
  ServiceType,
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
    const order = service.createOrderFromQuote('qte-1');
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
