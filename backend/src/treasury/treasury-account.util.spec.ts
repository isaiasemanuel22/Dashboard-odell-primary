import { PaymentMethod, TreasuryAccount } from '../common/enums';
import { defaultAccountForMethod } from './treasury-account.util';

describe('defaultAccountForMethod', () => {
  it('mapea cada medio a su cuenta', () => {
    expect(defaultAccountForMethod(PaymentMethod.EFECTIVO)).toBe(
      TreasuryAccount.CAJA,
    );
    expect(defaultAccountForMethod(PaymentMethod.TRANSFERENCIA)).toBe(
      TreasuryAccount.BANCO,
    );
    expect(defaultAccountForMethod(PaymentMethod.MERCADO_PAGO)).toBe(
      TreasuryAccount.MERCADO_PAGO,
    );
  });

  it('usa caja cuando el medio falta o es desconocido', () => {
    expect(defaultAccountForMethod(undefined)).toBe(TreasuryAccount.CAJA);
    expect(defaultAccountForMethod(null)).toBe(TreasuryAccount.CAJA);
    expect(defaultAccountForMethod('otro')).toBe(TreasuryAccount.CAJA);
  });
});
