import {
  collectedPaymentsCents,
  outstandingCents,
  paidCents,
  paymentNetCents,
  toCents,
} from './money.util';

describe('money.util', () => {
  it('redondea a centavos sin errores de punto flotante', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1999.995)).toBe(200000);
  });

  it('trata valores no numéricos como 0', () => {
    expect(toCents(undefined)).toBe(0);
    expect(toCents('abc')).toBe(0);
  });

  it('suma los pagos del pedido', () => {
    expect(paidCents({})).toBe(0);
    expect(paidCents({ payments: [{ amount: 10.1 }, { amount: 5.2 }] })).toBe(
      1530,
    );
  });

  it('calcula el neto cobrado restando comisión', () => {
    expect(paymentNetCents({ amount: 100, fee: 3.5 })).toBe(9650);
    expect(
      collectedPaymentsCents({
        payments: [{ amount: 100, fee: 3.5 }, { amount: 50 }],
      }),
    ).toBe(14650);
  });

  it('calcula el saldo impago sin bajar de cero', () => {
    expect(outstandingCents({ total: 100, payments: [{ amount: 40 }] })).toBe(
      6000,
    );
    expect(outstandingCents({ total: 100, payments: [{ amount: 120 }] })).toBe(
      0,
    );
  });
});
