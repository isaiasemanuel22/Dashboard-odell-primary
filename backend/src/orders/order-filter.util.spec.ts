import { OrderStatus, ServiceType } from '../common/enums';
import { filterOrders } from './order-filter.util';

describe('filterOrders', () => {
  const orders = [
    {
      id: 'ord-1',
      customerId: 'cust-1',
      customerName: 'Ana',
      services: [ServiceType.IMPRESION_3D],
      items: [{ productName: 'Pieza A', serviceType: ServiceType.IMPRESION_3D, quantity: 1, unitPrice: 10 }],
      status: OrderStatus.PENDIENTE,
      total: 10,
      createdAt: '2026-07-01T10:00:00.000Z',
      dueDate: '2026-07-10T18:00:00.000Z',
    },
    {
      id: 'ord-2',
      customerId: 'cust-2',
      customerName: 'Bruno',
      services: [ServiceType.ESTAMPADO],
      items: [{ productName: 'Remera', serviceType: ServiceType.ESTAMPADO, quantity: 2, unitPrice: 20 }],
      status: OrderStatus.ENTREGADO,
      total: 40,
      createdAt: '2026-07-02T10:00:00.000Z',
      dueDate: '2026-07-11T18:00:00.000Z',
    },
  ] as never[];

  it('filtra pedidos abiertos', () => {
    const result = filterOrders(orders, { openOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ord-1');
  });

  it('filtra por servicio y búsqueda', () => {
    const result = filterOrders(orders, {
      service: ServiceType.ESTAMPADO,
      q: 'remera',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ord-2');
  });
});
