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

  it('registra entrega parcial y descuenta solo stock reservado', () => {
    const order = store.orders[0]!;
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
});
