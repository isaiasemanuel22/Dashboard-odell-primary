import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MachineProfileRole,
  OrderStatus,
  PrintJobStatus,
  ProductType,
  ServiceType,
  TaskType,
} from '../common/enums';
import { CreateIndependentTaskDto } from '../common/dto';
import { PrintJob } from '../common/interfaces';
import { OrderTasksService } from './order-tasks.service';
import { PrintJobsService } from './print-jobs.service';
import { PrinterQueueService } from './printer-queue.service';
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

describe('PrinterQueueService', () => {
  function setup() {
    const store = new StoreService();
    const state = createEmptyState();
    state.generalSettings.machineProfiles = [
      {
        id: 'a1-1',
        name: 'A1 #1',
        role: MachineProfileRole.PRINT,
        watts: 100,
        costPerHour: 100,
        productType: ProductType.FDM,
        queueEnabled: true,
        workHoursPerDay: 16,
        workWeekdays: [1, 2, 3, 4, 5, 6],
        workStartHour: '08:00',
        costBase: true,
      },
      {
        id: 'a1-2',
        name: 'A1 #2',
        role: MachineProfileRole.PRINT,
        watts: 100,
        costPerHour: 100,
        productType: ProductType.FDM,
        queueEnabled: true,
        workHoursPerDay: 16,
        workWeekdays: [1, 2, 3, 4, 5, 6],
        workStartHour: '08:00',
      },
    ];
    state.products.push({
      id: 'prod-fdm',
      name: 'Pieza FDM',
      type: ProductType.FDM,
      categoryId: 'cat-1',
      price: 1000,
      cost: 500,
      stock: 0,
      grams: 50,
      printTimeHours: 4,
      workTimeHours: 0,
      updatedAt: new Date().toISOString(),
    } as never);
    state.products.push({
      id: 'prod-res',
      name: 'Pieza resina',
      type: ProductType.RESINA,
      categoryId: 'cat-1',
      price: 1000,
      cost: 500,
      stock: 0,
      grams: 20,
      printTimeHours: 2,
      workTimeHours: 0,
      updatedAt: new Date().toISOString(),
    } as never);
    store.applyState(state);
    const orderTasks = new OrderTasksService(store);
    const service = new PrinterQueueService(store, orderTasks);
    return { store, service };
  }

  function pushJob(
    store: StoreService,
    partial: Partial<PrintJob> & Pick<PrintJob, 'id' | 'productName'>,
  ) {
    const job: PrintJob = {
      orderId: '',
      orderItemIndex: -1,
      customerName: '',
      type: ServiceType.IMPRESION_3D,
      taskType: TaskType.PRODUCTION,
      status: PrintJobStatus.POR_HACER,
      active: true,
      priority: 1,
      machine: 'Impresora FDM',
      estimatedHours: 4,
      dueDate: '2026-03-10',
      ...partial,
    };
    store.printJobs.push(job);
    return job;
  }

  it('arma la cola por impresora y deja sin asignar las demás', () => {
    const { store, service } = setup();
    pushJob(store, {
      id: 'j1',
      productName: 'Asignada',
      printerId: 'a1-1',
      queuePosition: 0,
      estimatedHours: 2,
    });
    pushJob(store, {
      id: 'j2',
      productName: 'Sin asignar',
      estimatedHours: 3,
    });
    pushJob(store, {
      id: 'j-res',
      productName: 'Resina',
      productId: 'prod-res',
      taskType: TaskType.PRODUCTION,
      estimatedHours: 5,
    });

    const now = new Date('2026-03-06T13:00:00.000Z');
    const queue = service.getPrinterQueue(now);

    expect(queue.printers).toHaveLength(2);
    expect(queue.printers[0].jobs.map((j) => j.id)).toEqual(['j1']);
    expect(queue.unassigned.map((j) => j.id)).toEqual(['j2']);
    expect(queue.otherAreas.some((a) => a.count >= 1)).toBe(true);
    expect(queue.otherAreas.some((a) => a.area === 'impresion_3d_resina')).toBe(
      true,
    );
    expect(queue.printers[0].queuedHours).toBe(2);
  });

  it('excluye internas sin producto aunque type sea impresion_3d', () => {
    const { store, service } = setup();
    const correo = pushJob(store, {
      id: 'j-correo',
      productName: 'Sacar correo obligatorio de los clientes',
      type: ServiceType.IMPRESION_3D,
      taskType: TaskType.INTERNAL,
      estimatedHours: 4,
    });
    const fdm = pushJob(store, {
      id: 'j-fdm',
      productName: 'Pieza FDM',
      productId: 'prod-fdm',
      estimatedHours: 2,
    });
    const blocked = pushJob(store, {
      id: 'j-blocked',
      productName: 'Bloqueada por insumo',
      productId: 'prod-fdm',
      status: PrintJobStatus.BLOQUEADO,
      estimatedHours: 3,
    });

    expect(service.isEligibleForPrinterQueue(correo)).toBe(false);
    expect(service.isEligibleForPrinterQueue(fdm)).toBe(true);
    expect(service.isEligibleForPrinterQueue(blocked)).toBe(true);

    const queue = service.getPrinterQueue(new Date('2026-03-06T13:00:00.000Z'));
    expect(queue.unassigned.map((j) => j.id).sort()).toEqual([
      'j-blocked',
      'j-fdm',
    ]);
    expect(
      queue.otherAreas.some(
        (a) => a.area === '' && a.count >= 1,
      ),
    ).toBe(true);
    expect(
      queue.otherAreas.some((a) => a.area === ServiceType.IMPRESION_3D),
    ).toBe(false);
  });

  it('auto asigna a la impresora con menor busyUntil', () => {
    const { store, service } = setup();
    pushJob(store, {
      id: 'busy',
      productName: 'Ocupada',
      printerId: 'a1-1',
      queuePosition: 0,
      estimatedHours: 8,
    });
    const free = pushJob(store, {
      id: 'new',
      productName: 'Nueva',
      estimatedHours: 2,
      responsibleUserId: 'user-1',
    });

    const now = new Date('2026-03-06T13:00:00.000Z');
    const updated = service.assign(
      free.id,
      { printerId: 'auto' },
      { userId: 'user-1' },
    );
    expect(updated.printerId).toBe('a1-2');
    expect(updated.queuePosition).toBe(0);

    const estimate = service.deliveryEstimate(4, now);
    expect(estimate.printerId).toBe('a1-2');
  });

  it('rechaza asignación si el actor no es responsable ni admin', () => {
    const { store, service } = setup();
    pushJob(store, {
      id: 'j1',
      productName: 'Tarea',
      responsibleUserId: 'owner',
    });
    expect(() =>
      service.assign('j1', { printerId: 'a1-1' }, { userId: 'other' }),
    ).toThrow();
  });
});
