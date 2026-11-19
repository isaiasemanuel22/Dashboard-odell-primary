import {
  DEFAULT_ATTENDANT,
  normalizeAttendant,
} from './attendant-settings.util';

describe('normalizeAttendant', () => {
  it('arranca apagado, con 1 día con stock, 2 hábiles de margen y tope de USD 20', () => {
    expect(normalizeAttendant(undefined)).toEqual({
      enabled: false,
      stockDeliveryDays: 1,
      deliveryMarginDays: 2,
      monthlyBudgetUsd: 20,
      pausedByBudgetAt: null,
    });
    expect(normalizeAttendant({})).toEqual(DEFAULT_ATTENDANT);
  });

  it('respeta los valores guardados y descarta los inválidos', () => {
    expect(
      normalizeAttendant({
        enabled: true,
        stockDeliveryDays: 0,
        deliveryMarginDays: 1.5,
        monthlyBudgetUsd: -3,
        pausedByBudgetAt: '2026-11-19T12:00:00.000Z',
        otra: true,
      }),
    ).toEqual({
      enabled: true,
      stockDeliveryDays: 0,
      deliveryMarginDays: 2,
      monthlyBudgetUsd: 20,
      pausedByBudgetAt: '2026-11-19T12:00:00.000Z',
    });
  });
});
