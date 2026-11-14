/** Pasa un importe en pesos a centavos enteros; valores no numéricos cuentan como 0. */
export function toCents(value: unknown): number {
  return Math.round((Number(value) || 0) * 100);
}

/** Comisión de un pago en centavos. */
export function paymentFeeCents(payment: { fee?: number }): number {
  return toCents(payment.fee);
}

/** Neto cobrado de un pago (monto − comisión) en centavos. */
export function paymentNetCents(payment: {
  amount: number;
  fee?: number;
}): number {
  return toCents(payment.amount) - paymentFeeCents(payment);
}

/** Pagos que siguen vigentes (sin anular). */
export function activePayments<T extends { voidedAt?: string }>(
  payments: T[] | undefined,
): T[] {
  return (payments ?? []).filter((payment) => !payment.voidedAt);
}

/** Suma de los pagos vigentes, en centavos (bruto hacia el saldo del pedido). */
export function paidCents(order: {
  payments?: { amount: number; voidedAt?: string }[];
}): number {
  return activePayments(order.payments).reduce(
    (sum, payment) => sum + toCents(payment.amount),
    0,
  );
}

/**
 * Dinero que entra a caja por los pagos del pedido (neto de comisiones),
 * en centavos.
 */
export function collectedPaymentsCents(order: {
  payments?: { amount: number; fee?: number; voidedAt?: string }[];
}): number {
  return activePayments(order.payments).reduce(
    (sum, payment) => sum + paymentNetCents(payment),
    0,
  );
}

/** Saldo impago del pedido en centavos (nunca negativo). */
export function outstandingCents(order: {
  total: number;
  payments?: { amount: number; voidedAt?: string }[];
}): number {
  return Math.max(0, toCents(order.total) - paidCents(order));
}
