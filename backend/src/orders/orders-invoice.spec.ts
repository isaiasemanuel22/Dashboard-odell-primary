import { CustomerType, OrderStatus } from '../common/enums';
import { OrderTasksService } from '../print-jobs/order-tasks.service';
import { PrintJobsService } from '../print-jobs/print-jobs.service';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import {
  CustomerRepository,
  OrderRepository,
  ProductRepository,
} from '../store/repositories';
import { createEmptyState } from '../store/store.seed';
import { StoreService } from '../store/store.service';
import { OrdersService } from './orders.service';

describe('OrdersService factura y WhatsApp (§28)', () => {
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
      type: CustomerType.PARTICULAR,
      createdAt: '2026-07-01T10:00:00.000Z',
    });
    for (const [id, status] of [
      ['ord-1', OrderStatus.ENTREGADO],
      ['ord-2', OrderStatus.ENTREGADO],
      ['ord-x', OrderStatus.CANCELADO],
    ] as const) {
      state.orders.push({
        id,
        customerId: 'cust-1',
        customerName: 'Cliente',
        services: [],
        items: [],
        status,
        total: 1000,
        createdAt: '2026-07-01T10:00:00.000Z',
        dueDate: '2026-07-10T18:00:00.000Z',
      });
    }
    store.applyState(state);
    for (const order of state.orders) store.indexOrder(order);
    const orderTasks = new OrderTasksService(store);
    service = new OrdersService(
      new OrderRepository(store),
      new CustomerRepository(store),
      new ProductRepository(store),
      orderTasks,
      new PrintJobsService(store, orderTasks),
      {} as unknown as CostCalculatorService,
      store,
    );
  });

  it('marca la factura C con número normalizado y lo deja en el historial', () => {
    const order = service.markInvoice('ord-1', {
      number: '3-41',
      issuedAt: '2026-11-10T15:00:00.000Z',
    });
    expect(order.invoice).toEqual({
      type: 'C',
      number: '0003-00000041',
      issuedAt: '2026-11-10T15:00:00.000Z',
    });
    expect(order.activityHistory).toHaveLength(1);
    expect(order.activityHistory?.[0]).toMatchObject({ kind: 'invoice' });
    expect(order.activityHistory?.[0].detail).toContain('0003-00000041');
  });

  it('rechaza facturar un pedido cancelado', () => {
    expect(() => service.markInvoice('ord-x', { number: '3-1' })).toThrow(
      'cancelado',
    );
  });

  it('rechaza un número repetido en otro pedido o en una venta de mostrador', () => {
    service.markInvoice('ord-1', { number: '3-41' });
    expect(() =>
      service.markInvoice('ord-2', { number: '0003-00000041' }),
    ).toThrow('ya está asignada');
    store.retailSales.push({
      id: 'sale-1',
      items: [],
      total: 10,
      soldAt: '2026-11-01T10:00:00.000Z',
      createdAt: '2026-11-01T10:00:00.000Z',
      invoice: {
        type: 'C',
        number: '0003-00000050',
        issuedAt: '2026-11-01T10:00:00.000Z',
      },
    });
    expect(() => service.markInvoice('ord-2', { number: '3-50' })).toThrow(
      'ya está asignada',
    );
  });

  it('permite corregir la factura del mismo pedido con el mismo número', () => {
    service.markInvoice('ord-1', { number: '3-41' });
    expect(() =>
      service.markInvoice('ord-1', { number: '3-41' }),
    ).not.toThrow();
  });

  it('quita la factura, lo registra y falla si no había', () => {
    service.markInvoice('ord-1', { number: '3-41' });
    const order = service.removeInvoice('ord-1');
    expect(order.invoice).toBeUndefined();
    expect(order.activityHistory).toHaveLength(2);
    expect(order.activityHistory?.[1].detail).toContain('quitada');
    expect(() => service.removeInvoice('ord-1')).toThrow('no tiene factura');
  });

  it('registra el aviso por WhatsApp (abrir o copiar)', () => {
    const order = service.logWhatsApp('ord-1', {
      templateId: 'tpl-listo',
      templateName: 'Tu pedido está listo',
      via: 'copy',
    });
    expect(order.activityHistory?.[0]).toMatchObject({
      kind: 'whatsapp',
      templateId: 'tpl-listo',
      via: 'copy',
    });
  });
});
