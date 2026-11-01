import { PaymentMethod, TreasuryAccount } from '../common/enums';

/** Cuenta por defecto según el medio de pago (§20). */
export function defaultAccountForMethod(
  method: PaymentMethod | string | undefined | null,
): TreasuryAccount {
  switch (method) {
    case PaymentMethod.TRANSFERENCIA:
      return TreasuryAccount.BANCO;
    case PaymentMethod.MERCADO_PAGO:
      return TreasuryAccount.MERCADO_PAGO;
    case PaymentMethod.EFECTIVO:
    default:
      return TreasuryAccount.CAJA;
  }
}

export const TREASURY_ACCOUNTS_ORDER: TreasuryAccount[] = [
  TreasuryAccount.CAJA,
  TreasuryAccount.MERCADO_PAGO,
  TreasuryAccount.BANCO,
];
