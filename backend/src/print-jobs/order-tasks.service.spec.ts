import { BadRequestException } from '@nestjs/common';
import {
  OrderStatus,
  PrintJobStatus,
  ServiceType,
  TaskType,
} from '../common/enums';
import { OrderTasksService } from './order-tasks.service';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';

describe('OrderTasksService', () => {
  let store: StoreService;
  let service: OrderTasksService;

  beforeEach(() => {
    store = new StoreService();
    store.applyState(createEmptyState());
    store.customers.push({
      id: 'cust-1',
      name: 'Cliente Test',
      email: 'test@ejemplo.com',
      phone: '123',
      createdAt: new Date().toISOString(),
    });
    store.products.push({
      id: 'prod-1',
      name: 'Pieza',
      images: [],
      attachments: [],
      updatedAt: new Date().toISOString(),
      price: 1000,
      cost: 500,
      profit: 500,
      categoryIds: [],
      type: 'fdm' as never,
      size: '10cm',
      published: true,
      components: [],
      assemblyTimeHours: 0,
      grams: 50,
      printTimeHours: 1,
      workTimeHours: 0,
      stock: 2,
    });
    service = new OrderTasksService(store);
  });

  it('crea Preparar pedido bloqueada para pedidos con productos', () => {
    const order = {
      id: 'ord-1',
      customerId: 'cust-1',
      customerName: 'Cliente Test',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
      status: OrderStatus.PENDIENTE,
      total: 1000,
      createdAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
    };

    store.orders.push(order);
    service.syncOrderTasks(order);

    expect(store.printJobs).toHaveLength(1);
    expect(store.printJobs[0].orderId).toBe('ord-1');
    expect(store.printJobs[0].taskType).toBe(TaskType.PREPARE_ORDER);
    expect(store.printJobs[0].status).toBe(PrintJobStatus.BLOQUEADO);
  });

  it('reserva stock al iniciar preparación y crea producción solo por faltante', () => {
    const order = {
      id: 'ord-stock',
      customerId: 'cust-1',
      customerName: 'Cliente Test',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 5,
          unitPrice: 1000,
        },
      ],
      status: OrderStatus.PENDIENTE,
      total: 5000,
      createdAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
    };
    store.orders.push(order);
    service.syncOrderTasks(order);

    expect(order.items[0].productionRequiredQuantity).toBe(3);
    expect(
      store.printJobs.find((task) => task.taskType === TaskType.PRODUCTION)
        ?.quantity,
    ).toBe(3);

    const prepare = store.printJobs.find(
      (task) => task.taskType === TaskType.PREPARE_ORDER,
    )!;
    service.beforeStatusChange(prepare, PrintJobStatus.EN_PROCESO);

    expect(order.items[0].reservedQuantity).toBe(2);
    expect(order.items[0].productionRequiredQuantity).toBe(3);
    expect(
      store.printJobs.find((task) => task.taskType === TaskType.PRODUCTION)
        ?.quantity,
    ).toBe(3);
    expect(store.products[0].stock).toBe(2);
  });

  it('planifica producción al confirmar cuando no hay stock', () => {
    store.products[0].stock = 0;
    const order = {
      id: 'ord-no-stock',
      customerId: 'cust-1',
      customerName: 'Cliente Test',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 2,
          unitPrice: 1000,
        },
      ],
      status: OrderStatus.PENDIENTE,
      total: 2000,
      createdAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
    };

    store.orders.push(order);
    service.syncOrderTasks(order);

    expect(order.items[0].productionRequiredQuantity).toBe(2);
    expect(order.items[0].reservedQuantity).toBe(0);
    expect(
      store.printJobs.find((task) => task.taskType === TaskType.PRODUCTION),
    ).toMatchObject({
      quantity: 2,
      productName: 'Hacer 2 Pieza',
    });
    expect(service.buildOperationalAlerts(order)).toEqual([
      expect.objectContaining({
        code: 'insufficient_stock',
        severity: 'warning',
      }),
    ]);
  });

  it('considera una tarea bloqueada como pedido pendiente', () => {
    const order = {
      id: 'ord-blocked',
      customerId: 'cust-1',
      customerName: 'Cliente Test',
      services: [ServiceType.IMPRESION_3D],
      items: [],
      status: OrderStatus.EN_PROGRESO,
      total: 0,
      createdAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
    };
    store.orders.push(order);
    store.printJobs.push({
      id: 'job-blocked',
      orderId: order.id,
      orderItemIndex: 0,
      customerName: order.customerName,
      productName: 'Producción',
      type: ServiceType.IMPRESION_3D,
      taskType: TaskType.PRODUCTION,
      status: PrintJobStatus.BLOQUEADO,
      active: false,
      priority: 1,
      machine: 'FDM',
      estimatedHours: 1,
      dueDate: order.dueDate,
    });

    service.syncOrderStatusFromTasks(order.id);

    expect(order.status).toBe(OrderStatus.PENDIENTE);
  });

  it('marca tareas como canceladas si el pedido se cancela', () => {
    const order = {
      id: 'ord-2',
      customerId: 'cust-1',
      customerName: 'Cliente Test',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
      status: OrderStatus.PENDIENTE,
      total: 1000,
      createdAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
    };

    store.orders.push(order);
    service.syncOrderTasks(order);
    order.status = OrderStatus.CANCELADO;
    service.syncOrderTasks(order);

    expect(store.printJobs.every((job) => job.status === 'cancelado')).toBe(
      true,
    );
  });
});

describe('OrdersService validations', () => {
  it('rechaza transición inválida de estado', () => {
    expect(() => {
      const { assertOrderStatusTransition } = require('../common/validators/domain.validators');
      assertOrderStatusTransition(OrderStatus.CANCELADO, OrderStatus.PENDIENTE);
    }).toThrow(BadRequestException);
  });
});
