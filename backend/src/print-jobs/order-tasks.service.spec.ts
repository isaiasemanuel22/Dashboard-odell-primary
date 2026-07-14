import { BadRequestException } from '@nestjs/common';
import { OrderStatus, ServiceType } from '../common/enums';
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
    });
    service = new OrderTasksService(store);
  });

  it('crea tareas al sincronizar un pedido de impresión 3D', () => {
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
