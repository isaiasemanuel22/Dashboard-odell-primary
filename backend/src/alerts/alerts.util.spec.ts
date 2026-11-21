import { OrderStatus } from '../common/enums';
import { ReorderRow } from '../supplies/supplies-reorder.service';
import {
  buildOrdersDueDigest,
  buildReceivablesEmail,
  stockAlertRows,
} from './alerts.util';

function order(id: string, dueDate: string, status = OrderStatus.PENDIENTE) {
  return { id, customerName: `Cliente ${id}`, status, dueDate, total: 1000 };
}

function row(partial: Partial<ReorderRow>): ReorderRow {
  return {
    supplyId: 'sup-1',
    name: 'PLA negro',
    unit: 'g',
    stock: 100,
    weeklyConsumption: 0,
    coversDays: null,
    supplier: null,
    orderBy: null,
    status: 'ok',
    reason: null,
    suggestedQuantity: 0,
    insufficientData: false,
    ...partial,
  };
}

describe('alerts.util', () => {
  it('usa el día de Argentina cerca de la medianoche UTC', () => {
    // 2026-11-19 01:30 UTC = 2026-11-18 22:30 en Argentina: hoy es 18, mañana 19.
    const now = new Date('2026-11-19T01:30:00.000Z');
    const digest = buildOrdersDueDigest(
      [
        order('ord-1', '2026-11-17'),
        order('ord-2', '2026-11-18'),
        order('ord-3', '2026-11-19'),
        order('ord-4', '2026-11-17', OrderStatus.ENTREGADO),
      ],
      now,
    );
    expect(digest.overdue.map((o) => o.id)).toEqual(['ord-1']);
    expect(digest.dueTomorrow.map((o) => o.id)).toEqual(['ord-3']);
    expect(digest.text).toContain('ord-1');
    expect(digest.text).toContain('Vencen mañana 19/11');
  });

  it('sin atrasados ni vencimientos mañana deja el texto vacío', () => {
    const now = new Date('2026-11-18T12:00:00.000Z');
    expect(buildOrdersDueDigest([order('ord-1', '2026-11-25')], now).text).toBe(
      '',
    );
  });

  it('stock: sin stock, bajo el mínimo y «pedir antes del» de hoy o vencido', () => {
    const rows = [
      row({ supplyId: 'a', reason: 'out_of_stock', orderBy: '2026-11-18' }),
      row({ supplyId: 'b', reason: 'below_min', orderBy: '2026-11-18' }),
      row({ supplyId: 'c', reason: 'forecast', orderBy: '2026-11-18' }),
      row({ supplyId: 'd', reason: 'forecast', orderBy: '2026-11-15' }),
      row({ supplyId: 'e', reason: 'forecast', orderBy: '2026-11-19' }),
      row({ supplyId: 'f', reason: 'forecast', orderBy: null }),
    ];
    expect(stockAlertRows(rows, '2026-11-18').map((r) => r.supplyId)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('email de saldos con total y escapando nombres', () => {
    const email = buildReceivablesEmail({
      clientDebt: 1500,
      orderCount: 1,
      rows: [
        {
          customerId: 'cust-1',
          customerName: 'Ana <b>',
          amount: 1500,
          orders: [
            {
              id: 'ord-1',
              amount: 1500,
              total: 3000,
              deliveredAt: '2026-11-10',
              summary: 'Taza',
            },
          ],
        },
      ],
    });
    expect(email.subject).toContain('1.500');
    expect(email.html).toContain('Ana &lt;b&gt;');
    expect(email.text).toContain('1 pedido entregado con saldo');
  });
});
