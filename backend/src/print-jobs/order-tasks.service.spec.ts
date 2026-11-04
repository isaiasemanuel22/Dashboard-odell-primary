import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  CustomerType,
  OrderStatus,
  PrintJobStatus,
  ServiceType,
  TaskType,
  FilamentType,
  ProductType,
  SupplyCategory,
} from '../common/enums';
import { Order, PrintJob, Product3D } from '../common/interfaces';
import { INDISTINTO_COLOR_ID } from '../common/color.util';
import { OrderTasksService } from './order-tasks.service';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';

const adminActor = { isAdmin: true };

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
      type: CustomerType.PARTICULAR,
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
      type: ProductType.FDM,
      size: '10cm',
      published: true,
      components: [],
      assemblyTimeHours: 0,
      includesPieces: false,
      grams: 50,
      printTimeHours: 1,
      workTimeHours: 0,
      stock: 2,
    });
    service = new OrderTasksService(store);
  });

  it('crea Preparar pedido bloqueada para pedidos con productos', () => {
    const order: Order = {
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
    const order: Order = {
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
    service.beforeStatusChange(prepare, PrintJobStatus.EN_PROCESO, adminActor);
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
    const order: Order = {
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
    service.beforeStatusChange(prepare, PrintJobStatus.EN_PROCESO, adminActor);

    expect(order.items[0].reservedQuantity).toBe(0);
    expect(
      store.printJobs.find((task) => task.taskType === TaskType.PRODUCTION),
    ).toMatchObject({
      quantity: 2,
      productName: 'Hacer 2 Pieza',
    });
  });

  it('no descuenta un pedido sin preparar del stock del siguiente', () => {
    const first: Order = {
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
    const second: Order = {
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
    service.beforeStatusChange(prepare, PrintJobStatus.EN_PROCESO, adminActor);
    prepare.status = PrintJobStatus.EN_PROCESO;
    service.syncOrderTasks(second);

    expect(first.items[0].reservedQuantity).toBe(2);
    expect(second.items[0].productionRequiredQuantity).toBe(3);
    expect(second.items[0].reservedQuantity).toBe(0);
    expect(store.products[0].stock).toBe(2);
  });

  it('considera una tarea bloqueada como pedido pendiente', () => {
    const order: Order = {
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
    const order: Order = {
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

    expect(
      store.printJobs.every((job) => job.status === PrintJobStatus.CANCELADO),
    ).toBe(true);
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
        category: SupplyCategory.FDM,
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
        category: SupplyCategory.FDM,
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
    } as Product3D;

    const order: Order = {
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
    service.beforeStatusChange(prepare, PrintJobStatus.EN_PROCESO, adminActor);
    prepare.status = PrintJobStatus.EN_PROCESO;

    const production = store.printJobs.find(
      (task) => task.taskType === TaskType.PRODUCTION,
    );
    expect(production).toBeDefined();
    expect(production?.status).not.toBe(PrintJobStatus.BLOQUEADO);

    store.supplies = store.supplies.filter(
      (supply) => supply.id !== 'sup-black',
    );
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
      category: SupplyCategory.FDM,
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
    } as Product3D;

    const order: Order = {
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
    service.beforeStatusChange(prepare, PrintJobStatus.EN_PROCESO, adminActor);
    prepare.status = PrintJobStatus.EN_PROCESO;

    expect(
      store.printJobs.find((task) => task.taskType === TaskType.PRODUCTION)
        ?.status,
    ).not.toBe(PrintJobStatus.BLOQUEADO);
  });

  function productionJob(
    status: PrintJobStatus,
    responsibleUserId = 'uid-responsable',
  ): PrintJob {
    return {
      id: 'job-move',
      orderId: 'ord-move',
      orderItemIndex: 0,
      customerName: 'Cliente Test',
      productName: 'Pieza',
      productId: 'prod-1',
      type: ServiceType.IMPRESION_3D,
      taskType: TaskType.PRODUCTION,
      status,
      blockedReason:
        status === PrintJobStatus.BLOQUEADO
          ? 'Insumos insuficientes'
          : undefined,
      active: false,
      priority: 1,
      machine: 'FDM',
      estimatedHours: 1,
      dueDate: new Date().toISOString(),
      quantity: 1,
      responsibleUserId,
    };
  }

  it('copia el responsable del pedido a las tareas abiertas', () => {
    const order: Order = {
      id: 'ord-resp',
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
      responsibleUserId: 'uid-a',
    };
    store.orders.push(order);
    service.syncOrderTasks(order);

    const prepare = store.printJobs.find(
      (task) => task.taskType === TaskType.PREPARE_ORDER,
    )!;
    expect(prepare.responsibleUserId).toBe('uid-a');
    prepare.status = PrintJobStatus.TERMINADO;

    store.printJobs.push({
      id: 'job-abierta',
      orderId: order.id,
      orderItemIndex: 5,
      customerName: order.customerName,
      productName: 'Pieza',
      type: ServiceType.IMPRESION_3D,
      taskType: TaskType.PRODUCTION,
      status: PrintJobStatus.POR_HACER,
      active: false,
      priority: 1,
      machine: 'FDM',
      estimatedHours: 1,
      dueDate: order.dueDate,
      responsibleUserId: 'uid-viejo',
    });

    order.responsibleUserId = 'uid-b';
    service.syncOrderTasks(order);

    expect(prepare.responsibleUserId).toBe('uid-a');
    expect(
      store.printJobs.find((job) => job.id === 'job-abierta')?.responsibleUserId,
    ).toBe('uid-b');
  });

  it('un administrador mueve una tarea bloqueada', () => {
    const job = productionJob(PrintJobStatus.BLOQUEADO);
    service.beforeStatusChange(job, PrintJobStatus.EN_PROCESO, adminActor);
    expect(job.blockedReason).toBeUndefined();
  });

  it('el responsable mueve su tarea', () => {
    const job = productionJob(PrintJobStatus.BLOQUEADO, 'uid-responsable');
    service.beforeStatusChange(job, PrintJobStatus.POR_HACER, {
      userId: 'uid-responsable',
    });
    expect(job.blockedReason).toBeUndefined();
  });

  it('un tercero no mueve ni una tarea desbloqueada', () => {
    const job = productionJob(PrintJobStatus.POR_HACER, 'uid-responsable');
    expect(() =>
      service.beforeStatusChange(job, PrintJobStatus.EN_PROCESO, {
        userId: 'uid-otro',
      }),
    ).toThrow(ForbiddenException);
    expect(job.status).toBe(PrintJobStatus.POR_HACER);
  });

  it('sin insumos no pasa a en progreso aunque mueva el responsable o un admin', () => {
    store.products[0] = {
      ...store.products[0],
      filaments: [
        {
          id: 'ff-1',
          filamentType: FilamentType.PLA,
          grams: 50,
        },
      ],
    } as Product3D;
    const job = productionJob(PrintJobStatus.BLOQUEADO);

    expect(() =>
      service.beforeStatusChange(job, PrintJobStatus.EN_PROCESO, adminActor),
    ).toThrow(BadRequestException);
    expect(() =>
      service.beforeStatusChange(job, PrintJobStatus.EN_PROCESO, {
        userId: 'uid-responsable',
      }),
    ).toThrow(BadRequestException);
    expect(job.status).toBe(PrintJobStatus.BLOQUEADO);
    expect(job.blockedReason).toBe('Insumos insuficientes');
  });

  it('reemplaza el faltante por un insumo de la misma categoría y deja mover la tarea', () => {
    store.products[0] = {
      ...store.products[0],
      filaments: [
        { id: 'ff-1', filamentType: FilamentType.PLA, grams: 50 },
      ],
    } as Product3D;
    store.supplies.push({
      id: 'sup-petg',
      name: 'PETG negro',
      category: SupplyCategory.FDM,
      filamentType: FilamentType.PETG,
      unit: 'kg',
      quantity: 1,
      minStock: 0,
      unitPrice: 10000,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    });
    const job = productionJob(PrintJobStatus.BLOQUEADO);
    service.applySupplyReplacements(job, [
      { requirementKey: 'fdm:0', supplyId: 'sup-petg' },
    ]);
    service.beforeStatusChange(job, PrintJobStatus.EN_PROCESO, adminActor);
    expect(job.blockedReason).toBeUndefined();
    expect(job.supplyReplacements).toEqual([
      { requirementKey: 'fdm:0', supplyId: 'sup-petg' },
    ]);
  });

  it('no acepta un reemplazo de otra categoría', () => {
    store.products[0] = {
      ...store.products[0],
      filaments: [
        { id: 'ff-1', filamentType: FilamentType.PLA, grams: 50 },
      ],
    } as Product3D;
    store.supplies.push({
      id: 'sup-polimero',
      name: 'Polímero',
      category: SupplyCategory.GENERAL,
      unit: 'unidad',
      quantity: 4,
      minStock: 0,
      unitPrice: 1000,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    });
    const job = productionJob(PrintJobStatus.BLOQUEADO);
    expect(() =>
      service.applySupplyReplacements(job, [
        { requirementKey: 'fdm:0', supplyId: 'sup-polimero' },
      ]),
    ).toThrow(BadRequestException);
  });

  it('bloquea la tarea abierta cuando el material que usa pasa a 0', () => {
    store.products[0] = {
      ...store.products[0],
      filaments: [{ id: 'ff-1', filamentType: FilamentType.PLA, grams: 50 }],
    } as Product3D;
    const supply = {
      id: 'sup-pla',
      name: 'PLA',
      category: SupplyCategory.FDM,
      filamentType: FilamentType.PLA,
      unit: 'kg',
      quantity: 0,
      minStock: 0,
      unitPrice: 10000,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    };
    store.supplies.push(supply);
    const job = productionJob(PrintJobStatus.EN_PROCESO);
    store.printJobs.push(job);

    expect(service.blockTasksForDepletedSupply(supply)).toBe(true);
    expect(job.status).toBe(PrintJobStatus.BLOQUEADO);
    expect(job.blockedReason).toBe('Insumos insuficientes');
  });

  it('no bloquea si otro insumo del mismo material todavía cubre', () => {
    store.products[0] = {
      ...store.products[0],
      filaments: [{ id: 'ff-1', filamentType: FilamentType.PLA, grams: 50 }],
    } as Product3D;
    const depleted = {
      id: 'sup-pla-vacio',
      name: 'PLA vacío',
      category: SupplyCategory.FDM,
      filamentType: FilamentType.PLA,
      unit: 'kg',
      quantity: 0,
      minStock: 0,
      unitPrice: 10000,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    };
    store.supplies.push(depleted, {
      id: 'sup-pla-lleno',
      name: 'PLA lleno',
      category: SupplyCategory.FDM,
      filamentType: FilamentType.PLA,
      unit: 'kg',
      quantity: 1,
      minStock: 0,
      unitPrice: 10000,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    });
    const job = productionJob(PrintJobStatus.POR_HACER);
    store.printJobs.push(job);

    expect(service.blockTasksForDepletedSupply(depleted)).toBe(false);
    expect(job.status).toBe(PrintJobStatus.POR_HACER);
  });

  it('bloquea la tarea si el insumo del producto pasa a 0', () => {
    store.products[0] = {
      ...store.products[0],
      supplies: [{ id: 'line-1', supplyId: 'sup-pol', quantity: 1 }],
    } as Product3D;
    const supply = {
      id: 'sup-pol',
      name: 'Polímero',
      category: SupplyCategory.GENERAL,
      unit: 'unidad',
      quantity: 0,
      minStock: 0,
      unitPrice: 800,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    };
    store.supplies.push(supply);
    const open = productionJob(PrintJobStatus.POR_HACER);
    const done = productionJob(PrintJobStatus.TERMINADO);
    done.id = 'job-done';
    store.printJobs.push(open, done);

    expect(service.blockTasksForDepletedSupply(supply)).toBe(true);
    expect(open.status).toBe(PrintJobStatus.BLOQUEADO);
    expect(open.blockedReason).toBe('Insumos insuficientes');
    expect(done.status).toBe(PrintJobStatus.TERMINADO);
  });

  it('bloquea la tarea de estampado que ya estaba en progreso si la taza está en 0', () => {
    store.products[0] = {
      ...store.products[0],
      name: 'Taza Frozen',
      type: ProductType.ESTAMPADO,
      stock: 0,
      supplies: [{ id: 'line-1', supplyId: 'sup-taza', quantity: 1 }],
    } as unknown as Product3D;
    store.supplies.push({
      id: 'sup-taza',
      name: 'Tazas cerámica blanca',
      category: SupplyCategory.ESTAMPADO,
      unit: 'unidad',
      quantity: 0,
      minStock: 0,
      unitPrice: 2500,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    });
    const order: Order = {
      id: 'ord-10',
      customerId: 'cust-1',
      customerName: 'Cliente Test',
      services: [ServiceType.ESTAMPADO],
      items: [
        {
          serviceType: ServiceType.ESTAMPADO,
          productId: 'prod-1',
          productName: 'Taza Frozen',
          quantity: 1,
          unitPrice: 3500,
        },
      ],
      status: OrderStatus.EN_PROGRESO,
      total: 3500,
      createdAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
    };
    store.orders.push(order);
    const job = productionJob(PrintJobStatus.EN_PROCESO);
    job.orderId = order.id;
    job.productName = 'Hacer 1 Taza Frozen';
    job.quantity = 1;
    store.printJobs.push(
      job,
      productionJob(PrintJobStatus.EN_REVISION, 'uid-responsable'),
    );
    const prepare = store.printJobs[store.printJobs.length - 1];
    prepare.id = 'job-prep';
    prepare.orderId = order.id;
    prepare.orderItemIndex = -1;
    prepare.taskType = TaskType.PREPARE_ORDER;
    prepare.productName = 'Preparar pedido #ord-10';

    service.syncOrderTasks(order);

    expect(job.status).toBe(PrintJobStatus.BLOQUEADO);
    expect(job.blockedReason).toBe('Insumos insuficientes');
    expect(() =>
      service.beforeStatusChange(job, PrintJobStatus.EN_PROCESO, adminActor),
    ).toThrow(BadRequestException);
  });

  it('no analiza insumos de una tarea en revisión o terminada', () => {
    store.products[0] = {
      ...store.products[0],
      name: 'Taza Frozen',
      type: ProductType.ESTAMPADO,
      stock: 0,
      supplies: [{ id: 'line-1', supplyId: 'sup-taza', quantity: 1 }],
    } as unknown as Product3D;
    const supply = {
      id: 'sup-taza',
      name: 'Tazas cerámica blanca',
      category: SupplyCategory.ESTAMPADO,
      unit: 'unidad',
      quantity: 0,
      minStock: 0,
      unitPrice: 2500,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    };
    store.supplies.push(supply);
    const order: Order = {
      id: 'ord-revision',
      customerId: 'cust-1',
      customerName: 'Cliente Test',
      services: [ServiceType.ESTAMPADO],
      items: [
        {
          serviceType: ServiceType.ESTAMPADO,
          productId: 'prod-1',
          productName: 'Taza Frozen',
          quantity: 1,
          unitPrice: 3500,
        },
      ],
      status: OrderStatus.EN_PROGRESO,
      total: 3500,
      createdAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
    };
    store.orders.push(order);
    const review = productionJob(PrintJobStatus.EN_REVISION);
    review.orderId = order.id;
    review.quantity = 1;
    const done = productionJob(PrintJobStatus.TERMINADO);
    done.id = 'job-done';
    done.orderId = order.id;
    store.printJobs.push(review, done);
    const prepare = productionJob(PrintJobStatus.EN_REVISION);
    prepare.id = 'job-prep';
    prepare.orderId = order.id;
    prepare.orderItemIndex = -1;
    prepare.taskType = TaskType.PREPARE_ORDER;
    store.printJobs.push(prepare);

    service.syncOrderTasks(order);
    service.blockTasksForDepletedSupply(supply);

    expect(review.status).toBe(PrintJobStatus.EN_REVISION);
    expect(review.blockedReason).toBeUndefined();
    expect(done.status).toBe(PrintJobStatus.TERMINADO);
  });

  it('al revisar el stock en 0 bloquea Por hacer con la leyenda de faltante', () => {
    store.products[0] = {
      ...store.products[0],
      supplies: [{ id: 'line-1', supplyId: 'sup-pol', quantity: 1 }],
    } as Product3D;
    store.supplies.push({
      id: 'sup-pol',
      name: 'Polímero',
      category: SupplyCategory.GENERAL,
      unit: 'unidad',
      quantity: 0,
      minStock: 0,
      unitPrice: 800,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    });
    const job = productionJob(PrintJobStatus.POR_HACER);
    store.printJobs.push(job);

    expect(service.blockTasksMissingStock()).toBe(true);
    expect(job.status).toBe(PrintJobStatus.BLOQUEADO);
    expect(job.blockedReason).toBe('Insumos insuficientes');
  });
});
