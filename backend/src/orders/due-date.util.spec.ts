import { OrderStatus } from '../common/enums';
import {
  DUE_DATE_AFTER_TODAY_MESSAGE,
  isDueDateAfterToday,
  isOrderDueOn,
  isOrderOverdue,
} from './due-date.util';

describe('due-date.util', () => {
  const today = new Date(2026, 9, 21, 15, 0, 0);

  it('acepta un día posterior a hoy', () => {
    expect(isDueDateAfterToday('2026-10-22', today)).toBe(true);
    expect(isDueDateAfterToday('2026-10-28T18:00:00.000Z', today)).toBe(true);
  });

  it('rechaza hoy y una fecha anterior', () => {
    expect(isDueDateAfterToday('2026-10-21', today)).toBe(false);
    expect(isDueDateAfterToday('2026-10-20T18:00:00.000Z', today)).toBe(false);
    expect(DUE_DATE_AFTER_TODAY_MESSAGE).toContain('posterior a hoy');
  });

  it('atrasado: abierto y con entrega antes de hoy en Argentina', () => {
    // 2026-10-22 01:00 UTC = 2026-10-21 22:00 en Argentina.
    const now = new Date('2026-10-22T01:00:00.000Z');
    const open = { status: OrderStatus.PENDIENTE, dueDate: '2026-10-20' };
    expect(isOrderOverdue(open, now)).toBe(true);
    expect(isOrderOverdue({ ...open, dueDate: '2026-10-21' }, now)).toBe(false);
    expect(
      isOrderOverdue({ ...open, status: OrderStatus.ENTREGADO }, now),
    ).toBe(false);
  });

  it('vence el día indicado solo si sigue abierto', () => {
    const order = { status: OrderStatus.EN_PROGRESO, dueDate: '2026-10-22' };
    expect(isOrderDueOn(order, '2026-10-22')).toBe(true);
    expect(isOrderDueOn(order, '2026-10-23')).toBe(false);
    expect(
      isOrderDueOn({ ...order, status: OrderStatus.CANCELADO }, '2026-10-22'),
    ).toBe(false);
  });
});
