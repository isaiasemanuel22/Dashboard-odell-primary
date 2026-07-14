import { OrderStatus, ProductType } from '../common/enums';
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
      createdAt: '2026-07-01T10:00:00.000Z',
    });
    state.products.push({
      id: 'prod-1',
      name: 'Pieza',
      type: ProductType.FDM,
      images: [],
      updatedAt: '2026-07-01T10:00:00.000Z',
      price: 100,
      cost: 50,
      profit: 50,
      categoryIds: [],
      size: '10 cm',
      published: true,
      components: [],
      assemblyTimeHours: 0,
      grams: 10,
      printTimeHours: 1,
      workTimeHours: 0,
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
    store.indexOrder(state.orders[0]!);

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
    );
  });

  it('devuelve pedido y tareas en una sola respuesta', () => {
    const overview = service.getOverview('ord-1');

    expect(overview.order.id).toBe('ord-1');
    expect(overview.customers).toBeUndefined();
    expect(overview.products).toBeUndefined();
    expect(Array.isArray(overview.tasks)).toBe(true);
  });
});
