import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrderStatus, PrintJobStatus, ServiceType, TaskType } from '../common/enums';
import { CreateIndependentTaskDto } from '../common/dto';
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
      type: ServiceType.IMPRESION_3D,
      status: PrintJobStatus.POR_HACER,
      active: true,
      priority: 1,
      machine: '',
      estimatedHours: 0,
      dueDate: '2026-07-10T18:00:00.000Z',
    });
    store.applyState(state);
    store.indexOrder(state.orders[0]);

    const orderTasks = new OrderTasksService(store);
    const service = new PrintJobsService(store, orderTasks);
    const board = service.getBoard();

    expect(board.jobs).toHaveLength(1);
    expect(board.orderStatuses['ord-1']).toBe(OrderStatus.EN_PRODUCCION);
  });
});

describe('PrintJobsService.createIndependent', () => {
  function service(): PrintJobsService {
    const store = new StoreService();
    store.applyState(createEmptyState());
    return new PrintJobsService(store, new OrderTasksService(store));
  }

  it('guarda la tarea sin área ni máquina cuando el área viene vacía', () => {
    const job = service().createIndependent({
      productName: 'Llaveros para stock',
      type: '',
    });

    expect(job.orderId).toBe('');
    expect(job.type).toBe('');
    expect(job.machine).toBe('');
    expect(job.taskType).toBe(TaskType.INTERNAL);
    expect(job.status).toBe(PrintJobStatus.POR_HACER);
  });

  it('trata el área omitida como sin área', () => {
    const job = service().createIndependent({
      productName: 'Ordenar estantería',
    });

    expect(job.type).toBe('');
    expect(job.machine).toBe('');
  });

  it('con área asigna la máquina de esa área', () => {
    const job = service().createIndependent({
      productName: 'Estampa',
      type: ServiceType.ESTAMPADO,
    });

    expect(job.type).toBe(ServiceType.ESTAMPADO);
    expect(job.machine).toBe('Estampado');
  });

  it('el DTO acepta área vacía u omitida y rechaza un área desconocida', async () => {
    const empty = await validate(
      plainToInstance(CreateIndependentTaskDto, {
        productName: 'Llaveros',
        type: '',
      }),
    );
    const omitted = await validate(
      plainToInstance(CreateIndependentTaskDto, {
        productName: 'Llaveros',
      }),
    );
    const unknown = await validate(
      plainToInstance(CreateIndependentTaskDto, {
        productName: 'Llaveros',
        type: 'ventas',
      }),
    );

    expect(empty).toHaveLength(0);
    expect(omitted).toHaveLength(0);
    expect(unknown.length).toBeGreaterThan(0);
  });
});
