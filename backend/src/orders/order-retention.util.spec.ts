import { OrderStatus } from '../common/enums';
import { Order } from '../common/interfaces';
import {
  getTerminalStatusSince,
  shouldPurgeTerminalOrder,
} from './order-retention.util';
import { appendOrderStatusHistory } from './order-status-history.util';

describe('order-retention.util', () => {
  const baseOrder = (): Order => ({
    id: 'ord-1',
    customerId: 'cust-1',
    customerName: 'Test',
    services: [],
    items: [],
    status: OrderStatus.PENDIENTE,
    total: 0,
    createdAt: '2026-01-01T10:00:00.000Z',
    dueDate: '2026-01-10T18:00:00.000Z',
    statusHistory: [],
  });

  it('getTerminalStatusSince returns null for open orders', () => {
    expect(getTerminalStatusSince(baseOrder())).toBeNull();
  });

  it('getTerminalStatusSince uses latest terminal transition', () => {
    const order = baseOrder();
    appendOrderStatusHistory(
      order,
      null,
      OrderStatus.PENDIENTE,
      'manual',
      '2026-01-01T10:00:00.000Z',
    );
    appendOrderStatusHistory(
      order,
      OrderStatus.PENDIENTE,
      OrderStatus.ENTREGADO,
      'manual',
      '2026-02-01T12:00:00.000Z',
    );
    order.status = OrderStatus.ENTREGADO;

    expect(getTerminalStatusSince(order)?.toISOString()).toBe(
      '2026-02-01T12:00:00.000Z',
    );
  });

  it('shouldPurgeTerminalOrder is false before retention period', () => {
    const order = baseOrder();
    order.status = OrderStatus.ENTREGADO;
    appendOrderStatusHistory(
      order,
      null,
      OrderStatus.ENTREGADO,
      'manual',
      '2026-06-01T10:00:00.000Z',
    );

    expect(
      shouldPurgeTerminalOrder(order, new Date('2026-06-15T10:00:00.000Z')),
    ).toBe(false);
  });

  it('shouldPurgeTerminalOrder is true after 30 days', () => {
    const order = baseOrder();
    order.status = OrderStatus.CANCELADO;
    appendOrderStatusHistory(
      order,
      null,
      OrderStatus.CANCELADO,
      'manual',
      '2026-01-01T10:00:00.000Z',
    );

    expect(
      shouldPurgeTerminalOrder(order, new Date('2026-02-01T10:00:00.000Z')),
    ).toBe(true);
  });
});
