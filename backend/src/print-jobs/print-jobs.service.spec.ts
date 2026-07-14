import { OrderStatus } from '../common/enums';
import { OrderTasksService } from './order-tasks.service';
import { PrintJobsService } from './print-jobs.service';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';

describe('PrintJobsService.getBoard', () => {
  it('devuelve trabajos y estados de pedido', () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.orders.push({
      id: 'ord-1',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [],
      items: [],
      status: OrderStatus.EN_PRODUCCION,
      total: 0,
      createdAt: '2026-07-01T10:00:00.000Z',
      dueDate: '2026-07-10T18:00:00.000Z',
    });
    state.printJobs.push({
      id: 'job-1',
      orderId: 'ord-1',
      orderItemIndex: 0,
      customerName: 'Cliente',
      productName: 'Pieza',
      type: 'impresion_3d' as never,
      status: 'por_hacer' as never,
      active: true,
      priority: 1,
    });
    store.applyState(state);
    store.indexOrder(state.orders[0]!);

    const orderTasks = new OrderTasksService(store);
    const service = new PrintJobsService(store, orderTasks);
    const board = service.getBoard();

    expect(board.jobs).toHaveLength(1);
    expect(board.orderStatuses['ord-1']).toBe(OrderStatus.EN_PRODUCCION);
  });
});
