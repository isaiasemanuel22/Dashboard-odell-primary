/** Pasa un importe en pesos a centavos enteros; valores no numéricos cuentan como 0. */
export function toCents(value: unknown): number {
  return Math.round((Number(value) || 0) * 100);
}

/** Suma de los pagos registrados, en centavos. */
export function paidCents(order: { payments?: { amount: number }[] }): number {
  return (order.payments ?? []).reduce(
    (sum, payment) => sum + toCents(payment.amount),
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
