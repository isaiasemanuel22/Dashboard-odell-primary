import { FilamentType, QuoteStatus, ServiceType } from '../common/enums';
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

describe('QuotesService producto nuevo', () => {
  it('al aceptar crea el producto no publicado y lo incorpora al pedido', () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-1',
      name: 'Cliente',
      email: 'a@test.com',
      phone: '123',
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

    const orderTasks = new OrderTasksService(store);
    const printJobs = new PrintJobsService(store, orderTasks);
    const orders = new OrdersService(
      new OrderRepository(store),
      new CustomerRepository(store),
      new ProductRepository(store),
      orderTasks,
      printJobs,
      new CostCalculatorService(store),
    );
    const service = new QuotesService(
      new QuoteRepository(store),
      new CustomerRepository(store),
      orders,
      new ProductRepository(store),
      store,
      { recordChange: jest.fn() } as unknown as StoreChangeService,
    );

    const order = service.createOrderFromQuote('qte-1');
    const productId = order.items[0]?.productId;

    expect(productId).toBeTruthy();
    const product = store.getProductById(productId!);
    expect(product?.published).toBe(false);
    expect(product?.name).toBe('Mate nuevo');
    expect(product?.categoryIds).toEqual([]);
    expect(product && 'brandId' in product ? product.brandId : undefined).toBeUndefined();
    expect(order.items[0]?.unitPrice).toBe(2500);
    expect(store.getQuoteById('qte-1')?.items[0]?.productId).toBe(productId);
  });
});