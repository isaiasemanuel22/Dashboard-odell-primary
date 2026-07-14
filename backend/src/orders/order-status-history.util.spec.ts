import { OrderStatus } from '../common/enums';
import {
  appendOrderStatusHistory,
  ensureOrderStatusHistory,
  sortStatusHistoryNewestFirst,
} from './order-status-history.util';

describe('order-status-history.util', () => {
  const baseOrder = () => ({
    id: 'ord-1',
    customerId: 'cust-1',
    customerName: 'Test',
    services: [],
    items: [],
    status: OrderStatus.PENDIENTE,
    total: 0,
    createdAt: '2026-07-01T10:00:00.000Z',
    dueDate: '2026-07-10T18:00:00.000Z',
    statusHistory: [],
  });

  it('appendOrderStatusHistory adds entry when status changes', () => {
    const order = baseOrder();
    appendOrderStatusHistory(order, null, OrderStatus.PENDIENTE, 'manual');
    expect(order.statusHistory).toHaveLength(1);
    expect(order.statusHistory![0]).toMatchObject({
      fromStatus: null,
      toStatus: OrderStatus.PENDIENTE,
      source: 'manual',
    });
  });

  it('appendOrderStatusHistory skips duplicate status', () => {
    const order = baseOrder();
    appendOrderStatusHistory(
      order,
      OrderStatus.PENDIENTE,
      OrderStatus.PENDIENTE,
      'manual',
    );
    expect(order.statusHistory).toHaveLength(0);
  });

  it('ensureOrderStatusHistory creates fallback entry', () => {
    const order = baseOrder();
    delete order.statusHistory;
    ensureOrderStatusHistory(order);
    expect(order.statusHistory).toHaveLength(1);
    expect(order.statusHistory![0].toStatus).toBe(OrderStatus.PENDIENTE);
  });

  it('sortStatusHistoryNewestFirst orders by changedAt desc', () => {
    const sorted = sortStatusHistoryNewestFirst([
      {
        id: '1',
        fromStatus: OrderStatus.PENDIENTE,
        toStatus: OrderStatus.EN_PRODUCCION,
        changedAt: '2026-07-02T10:00:00.000Z',
        source: 'manual',
      },
      {
        id: '2',
        fromStatus: null,
        toStatus: OrderStatus.PENDIENTE,
        changedAt: '2026-07-01T10:00:00.000Z',
        source: 'manual',
      },
    ]);
    expect(sorted[0].id).toBe('1');
  });
});
