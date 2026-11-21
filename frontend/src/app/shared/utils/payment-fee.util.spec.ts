import { PaymentMethod } from '../../core/models';
import { defaultPaymentFee } from './payment-fee.util';

describe('defaultPaymentFee', () => {
  it('calcula el porcentaje solo con Mercado Pago', () => {
    expect(defaultPaymentFee(10000, PaymentMethod.MERCADO_PAGO, 6.29)).toBe(629);
    expect(defaultPaymentFee(1234, PaymentMethod.MERCADO_PAGO, 5)).toBe(62);
  });

  it('da 0 con efectivo o transferencia', () => {
    expect(defaultPaymentFee(10000, PaymentMethod.EFECTIVO, 6)).toBe(0);
    expect(defaultPaymentFee(10000, PaymentMethod.TRANSFERENCIA, 6)).toBe(0);
  });

  it('da 0 con monto o porcentaje inválidos', () => {
    expect(defaultPaymentFee(null, PaymentMethod.MERCADO_PAGO, 6)).toBe(0);
    expect(defaultPaymentFee(-5, PaymentMethod.MERCADO_PAGO, 6)).toBe(0);
    expect(defaultPaymentFee(1000, PaymentMethod.MERCADO_PAGO, 0)).toBe(0);
    expect(defaultPaymentFee(1000, PaymentMethod.MERCADO_PAGO, undefined)).toBe(0);
  });
});
