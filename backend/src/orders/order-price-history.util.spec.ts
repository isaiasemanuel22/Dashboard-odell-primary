import { OrderStatus } from '../common/enums';
import { Order } from '../common/interfaces';
import {
  appendOrderPriceHistory,
  sortOrderPriceHistory,
} from './order-price-history.util';

describe('order-price-history.util', () => {
  const baseOrder = (): Order => ({
    id: 'ord-1',
    customerId: null,
    customerName: 'Cliente',
    services: [],
    items: [],
    status: OrderStatus.PENDIENTE,
    total: 1000,
    createdAt: '2026-01-01T00:00:00.000Z',
    dueDate: '2026-01-10T00:00:00.000Z',
    priceHistory: [],
  });

  it('appendOrderPriceHistory agrega entrada con precios anterior y nuevo', () => {
    const order = baseOrder();
    appendOrderPriceHistory(order, {
      trigger: 'supply_price',
      itemIndex: 0,
      productId: 'prod-1',
      productName: 'Pieza A',
      previousUnitPrice: 100,
      newUnitPrice: 120,
      previousOrderTotal: 1000,
      newOrderTotal: 1020,
    });

    expect(order.priceHistory).toHaveLength(1);
    expect(order.priceHistory![0]).toMatchObject({
      previousUnitPrice: 100,
      newUnitPrice: 120,
      trigger: 'supply_price',
    });
  });

  it('sortOrderPriceHistory ordena por fecha descendente', () => {
    const sorted = sortOrderPriceHistory([
      {
        id: '1',
        changedAt: '2026-01-01T00:00:00.000Z',
        trigger: 'settings',
        itemIndex: 0,
        productId: 'p1',
        productName: 'A',
        previousUnitPrice: 1,
        newUnitPrice: 2,
        previousOrderTotal: 10,
        newOrderTotal: 11,
      },
      {
        id: '2',
        changedAt: '2026-02-01T00:00:00.000Z',
        trigger: 'settings',
        itemIndex: 0,
        productId: 'p1',
        productName: 'A',
        previousUnitPrice: 2,
        newUnitPrice: 3,
        previousOrderTotal: 11,
        newOrderTotal: 12,
      },
    ]);

    expect(sorted[0].id).toBe('2');
  });
});
