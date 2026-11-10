import {
  OrderStatus,
  PaymentMethod,
  PriceType,
  ServiceType,
  TreasuryAccount,
} from '../../common/enums';
import { mapOrderFromDb, mapOrderToDbCreate } from './order.mapper';

describe('order.mapper payments', () => {
  it('hace ida y vuelta de un pedido con pagos', () => {
    const createdAt = new Date('2026-08-01T12:00:00.000Z');
    const dueDate = new Date('2026-08-10T12:00:00.000Z');
    const payments = [
      {
        id: 'ord-1-pay-1',
        amount: 1500.5,
        deposit: true,
        createdAt: '2026-08-02T10:00:00.000Z',
        method: PaymentMethod.MERCADO_PAGO,
        account: TreasuryAccount.MERCADO_PAGO,
        fee: 45.5,
      },
      {
        id: 'ord-1-pay-2',
        amount: 500,
        deposit: false,
        createdAt: '2026-08-03T10:00:00.000Z',
        method: PaymentMethod.EFECTIVO,
        account: TreasuryAccount.CAJA,
        fee: 0,
      },
    ];

    const fromDb = mapOrderFromDb({
      id: 'ord-1',
      customerId: 'cust-1',
      customerName: 'Ana',
      services: [ServiceType.IMPRESION_3D],
      status: OrderStatus.PENDIENTE,
      total: 2000.5,
      priceType: PriceType.LISTA,
      wholesaleApplied: false,
      salesChannel: null,
      discountPercent: 0,
      discountAmount: 0,
      description: null,
      notes: null,
      createdAt,
      dueDate,
      statusHistory: [],
      priceHistory: [],
      deliveryHistory: [],
      payments,
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: null,
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 2000.5,
        },
      ],
    });

    expect(fromDb.payments).toEqual(payments);

    const toDb = mapOrderToDbCreate(fromDb);
    expect(toDb.payments).toEqual(payments);

    const roundTrip = mapOrderFromDb({
      ...toDb,
      id: 'ord-1',
      customerId: toDb.customerId ?? null,
      customerName: String(toDb.customerName),
      services: toDb.services as never,
      status: String(toDb.status),
      total: Number(toDb.total),
      description: (toDb.description as string | null) ?? null,
      notes: (toDb.notes as string | null) ?? null,
      createdAt: toDb.createdAt as Date,
      dueDate: toDb.dueDate as Date,
      statusHistory: toDb.statusHistory as never,
      priceHistory: toDb.priceHistory as never,
      deliveryHistory: toDb.deliveryHistory as never,
      payments: toDb.payments as never,
      attachments: toDb.attachments as never,
      items: fromDb.items.map((item) => ({
        serviceType: item.serviceType,
        productId: item.productId ?? null,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });

    expect(roundTrip.payments).toEqual(payments);
  });

  it('hace ida y vuelta de los adjuntos del pedido', () => {
    const attachments = [
      {
        id: 'att-1',
        name: 'referencia.png',
        url: 'https://example.com/referencia.png',
        mimeType: 'image/png',
        size: 1234,
      },
    ];
    const base = {
      id: 'ord-a',
      customerId: null,
      customerName: 'Ana',
      services: [ServiceType.IMPRESION_3D] as never,
      status: OrderStatus.PENDIENTE,
      total: 0,
      description: null,
      notes: null,
      createdAt: new Date('2026-08-01T12:00:00.000Z'),
      dueDate: new Date('2026-08-10T12:00:00.000Z'),
      statusHistory: [] as never,
      items: [],
    };
    const order = mapOrderFromDb({ ...base, attachments });
    expect(order.attachments).toEqual(attachments);
    expect(mapOrderToDbCreate(order).attachments).toEqual(attachments);
    expect(mapOrderFromDb(base).attachments).toEqual([]);
  });

  it('mapea pagos ausentes a []', () => {
    const fromDb = mapOrderFromDb({
      id: 'ord-2',
      customerId: null,
      customerName: 'Bruno',
      services: [ServiceType.IMPRESION_3D],
      status: OrderStatus.PENDIENTE,
      total: 100,
      createdAt: new Date('2026-08-01T12:00:00.000Z'),
      dueDate: new Date('2026-08-10T12:00:00.000Z'),
      description: null,
      notes: null,
      statusHistory: [],
      items: [],
    });

    expect(fromDb.payments).toEqual([]);
  });
});
