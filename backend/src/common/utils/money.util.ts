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

/** Suma de los pagos registrados, en centavos (bruto hacia el saldo del pedido). */
export function paidCents(order: { payments?: { amount: number }[] }): number {
  return (order.payments ?? []).reduce(
    (sum, payment) => sum + toCents(payment.amount),
    0,
  );
}

/**
 * Dinero que entra a caja por los pagos del pedido (neto de comisiones),
 * en centavos.
 */
export function collectedPaymentsCents(order: {
  payments?: { amount: number; fee?: number }[];
}): number {
  return (order.payments ?? []).reduce(
    (sum, payment) => sum + paymentNetCents(payment),
    0,
  );
}

/** Saldo impago del pedido en centavos (nunca negativo). */
export function outstandingCents(order: {
  total: number;
  payments?: { amount: number }[];
}): number {
  return Math.max(0, toCents(order.total) - paidCents(order));
}
