import { BadRequestException } from '@nestjs/common';
import {
  OrderStatus,
  PrintJobStatus,
  ServiceType,
  TaskType,
  FilamentType,
} from '../common/enums';
import { INDISTINTO_COLOR_ID } from '../common/color.util';
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

    expect(order.items[0].reservedQuantity).toBe(0);
    expect(order.items[0].productionRequiredQuantity).toBe(3);
    expect(
      store.printJobs.find((task) => task.taskType === TaskType.PRODUCTION),
    ).toBeUndefined();

    const prepare = store.printJobs.find(
      (task) => task.taskType === TaskType.PREPARE_ORDER,
    )!;
    service.beforeStatusChange(prepare, PrintJobStatus.EN_PROCESO);
    prepare.status = PrintJobStatus.EN_PROCESO;

    expect(order.items[0].reservedQuantity).toBe(2);
    expect(order.items[0].productionRequiredQuantity).toBe(3);
    expect(
      store.printJobs.find((task) => task.taskType === TaskType.PRODUCTION)
        ?.quantity,
    ).toBe(3);
    expect(store.products[0].stock).toBe(2);
  });

  it('no reserva al confirmar y crea la producción al preparar', () => {
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
    ).toBeUndefined();
    expect(service.buildOperationalAlerts(order)).toEqual([
      expect.objectContaining({
        code: 'insufficient_stock',
        severity: 'warning',
      }),
    ]);

    const prepare = store.printJobs.find(
      (task) => task.taskType === TaskType.PREPARE_ORDER,
    )!;
    service.beforeStatusChange(prepare, PrintJobStatus.EN_PROCESO);

    expect(order.items[0].reservedQuantity).toBe(0);
    expect(
      store.printJobs.find((task) => task.taskType === TaskType.PRODUCTION),
    ).toMatchObject({
      quantity: 2,
      productName: 'Hacer 2 Pieza',
    });
  });

  it('no descuenta un pedido sin preparar del stock del siguiente', () => {
    const first = {
      id: 'ord-1',
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
    const second = {
      id: 'ord-2',
      customerId: 'cust-1',
      customerName: 'Cliente Test',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 3,
          unitPrice: 1000,
        },
      ],
      status: OrderStatus.PENDIENTE,
      total: 3000,
      createdAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
    };

    store.orders.push(first, second);
    service.syncOrderTasks(first);
    service.syncOrderTasks(second);

    expect(first.items[0].reservedQuantity).toBe(0);
    expect(first.items[0].productionRequiredQuantity).toBe(3);
    expect(second.items[0].reservedQuantity).toBe(0);
    expect(second.items[0].productionRequiredQuantity).toBe(1);
    expect(store.products[0].stock).toBe(2);

    const prepare = store.printJobs.find(
      (task) =>
        task.orderId === first.id && task.taskType === TaskType.PREPARE_ORDER,
    )!;
    service.beforeStatusChange(prepare, PrintJobStatus.EN_PROCESO);
    prepare.status = PrintJobStatus.EN_PROCESO;
    service.syncOrderTasks(second);

    expect(first.items[0].reservedQuantity).toBe(2);
    expect(second.items[0].productionRequiredQuantity).toBe(3);
    expect(second.items[0].reservedQuantity).toBe(0);
    expect(store.products[0].stock).toBe(2);
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

  it('exige insumo con color específico cuando el producto FDM lo define', () => {
    store.generalSettings.colors = [
      { id: 'clr-black', name: 'Negro', hex: '#000000' },
      { id: 'clr-white', name: 'Blanco', hex: '#FFFFFF' },
    ];
    store.supplies.push(
      {
        id: 'sup-black',
        name: 'PLA Negro',
        category: 'fdm',
        filamentType: FilamentType.PLA,
        brand: 'FilAr',
        unit: 'kg',
        quantity: 1,
        minStock: 0,
        unitPrice: 10000,
        priceFromSettings: false,
        colorId: 'clr-black',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'sup-white',
        name: 'PLA Blanco',
        category: 'fdm',
        filamentType: FilamentType.PLA,
        brand: 'FilAr',
        unit: 'kg',
        quantity: 1,
        minStock: 0,
        unitPrice: 10000,
        priceFromSettings: false,
        colorId: 'clr-white',
        updatedAt: new Date().toISOString(),
      },
    );
    store.products[0] = {
      ...store.products[0],
      stock: 0,
      filaments: [
        {
          id: 'ff-1',
          filamentType: FilamentType.PLA,
          grams: 50,
          colorId: 'clr-black',
        },
      ],
    };

    const order = {
      id: 'ord-color',
      customerId: 'cust-1',
      customerName: 'Cliente Test',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza negra',
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
    const prepare = store.printJobs.find(
      (task) => task.taskType === TaskType.PREPARE_ORDER,
    )!;
    service.beforeStatusChange(prepare, PrintJobStatus.EN_PROCESO);
    prepare.status = PrintJobStatus.EN_PROCESO;

    const production = store.printJobs.find(
      (task) => task.taskType === TaskType.PRODUCTION,
    );
    expect(production).toBeDefined();
    expect(production?.status).not.toBe(PrintJobStatus.BLOQUEADO);

    store.supplies = store.supplies.filter((supply) => supply.id !== 'sup-black');
    service.syncOrderTasks(order);

    expect(
      store.printJobs.find((task) => task.taskType === TaskType.PRODUCTION)
        ?.status,
    ).toBe(PrintJobStatus.BLOQUEADO);
  });

  it('ignora el color cuando el producto FDM usa indistinto', () => {
    store.supplies.push({
      id: 'sup-any',
      name: 'PLA Genérico',
      category: 'fdm',
      filamentType: FilamentType.PLA,
      brand: 'FilAr',
      unit: 'kg',
      quantity: 0.1,
      minStock: 0,
      unitPrice: 10000,
      priceFromSettings: false,
      colorId: 'clr-other',
      updatedAt: new Date().toISOString(),
    });
    store.products[0] = {
      ...store.products[0],
      stock: 0,
      filaments: [
        {
          id: 'ff-1',
          filamentType: FilamentType.PLA,
          grams: 50,
          colorId: INDISTINTO_COLOR_ID,
        },
      ],
    };

    const order = {
      id: 'ord-indistinto',
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
    const prepare = store.printJobs.find(
      (task) => task.taskType === TaskType.PREPARE_ORDER,
    )!;
    service.beforeStatusChange(prepare, PrintJobStatus.EN_PROCESO);
    prepare.status = PrintJobStatus.EN_PROCESO;

    expect(
      store.printJobs.find((task) => task.taskType === TaskType.PRODUCTION)
        ?.status,
    ).not.toBe(PrintJobStatus.BLOQUEADO);
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
