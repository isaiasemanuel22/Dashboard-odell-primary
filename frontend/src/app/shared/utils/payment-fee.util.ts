import { PaymentMethod } from '../../core/models';

/**
 * Comisión sugerida (en pesos enteros) para un cobro: solo Mercado Pago
 * descuenta comisión; efectivo y transferencia dan 0 (§28.1).
 */
export function defaultPaymentFee(
  amount: number | null | undefined,
  method: PaymentMethod | string | null | undefined,
  feePercent: number | null | undefined,
): number {
  if (method !== PaymentMethod.MERCADO_PAGO) return 0;
  const safeAmount = Number(amount);
  const percent = Number(feePercent);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round((safeAmount * percent) / 100);
}
