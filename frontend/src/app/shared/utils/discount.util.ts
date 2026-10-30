export type DiscountMode = 'none' | 'percent' | 'amount';

export interface DiscountInput {
  discountPercent?: number;
  discountAmount?: number;
}

/** Máximo % de descuento permitido (100% dejaría el total en $0). */
export const DISCOUNT_PERCENT_MAX = 99;

export function discountModeFromValues(
  discountPercent?: number,
  discountAmount?: number,
): DiscountMode {
  if ((discountAmount ?? 0) > 0) return 'amount';
  if ((discountPercent ?? 0) > 0) return 'percent';
  return 'none';
}

export function calculateItemsSubtotal(
  items: Array<{ quantity: number; unitPrice: number }>,
): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

/** Clampea % al rango válido 0–99. */
export function clampDiscountPercent(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), DISCOUNT_PERCENT_MAX);
}

/**
 * Clampea monto $ al rango válido 0 … subtotal−1.
 * Si subtotal ≤ 0, fuerza 0.
 */
export function clampDiscountAmount(value: number, subtotal: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const sub = Number(subtotal);
  if (!Number.isFinite(sub) || sub <= 0) return 0;
  const max = Math.max(0, Math.round(sub) - 1);
  return Math.min(Math.max(n, 0), max);
}

/** Aviso corto si el valor de % se ajustó al rango (Q3). */
export function discountPercentClampMessage(raw: number): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'El descuento se ajustó a un valor válido';
  if (n < 0) return 'El descuento no puede ser negativo; se ajustó a 0 %';
  if (n > DISCOUNT_PERCENT_MAX) {
    return `El descuento máximo es ${DISCOUNT_PERCENT_MAX} %; se ajustó`;
  }
  return '';
}

/** Aviso corto si el monto $ se ajustó al rango (Q3). */
export function discountAmountClampMessage(
  raw: number,
  subtotal: number,
): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'El descuento se ajustó a un valor válido';
  if (n < 0) return 'El descuento no puede ser negativo; se ajustó a $0';
  const sub = Number(subtotal);
  if (!Number.isFinite(sub) || sub <= 0) {
    return n > 0 ? 'Sin subtotal no hay descuento; se ajustó a $0' : '';
  }
  const max = Math.max(0, Math.round(sub) - 1);
  if (n > max) {
    return 'El descuento no puede cubrir todo el subtotal; se ajustó';
  }
  return '';
}

export function calculateDiscountValue(
  subtotal: number,
  discountPercent = 0,
  discountAmount = 0,
): number {
  if (subtotal <= 0) return 0;

  const fixed = clampDiscountAmount(discountAmount || 0, subtotal);
  if (fixed > 0) {
    return Math.round(fixed);
  }

  const percent = clampDiscountPercent(discountPercent || 0);
  if (percent > 0) {
    return Math.round(subtotal * (percent / 100));
  }

  return 0;
}

export function calculateTotalWithDiscount(
  subtotal: number,
  discountPercent = 0,
  discountAmount = 0,
): number {
  const discount = calculateDiscountValue(
    subtotal,
    discountPercent,
    discountAmount,
  );
  return Math.max(0, Math.round(subtotal - discount));
}

export function discountPayloadFromMode(
  mode: DiscountMode,
  discountPercent: number,
  discountAmount: number,
  /** Si se pasa, el monto $ se clampea a 0 … subtotal−1. */
  subtotal?: number,
): DiscountInput {
  if (mode === 'percent') {
    return {
      discountPercent: clampDiscountPercent(discountPercent || 0),
      discountAmount: 0,
    };
  }

  if (mode === 'amount') {
    const raw = Number(discountAmount) || 0;
    return {
      discountPercent: 0,
      discountAmount:
        subtotal === undefined
          ? Math.max(raw, 0)
          : clampDiscountAmount(raw, subtotal),
    };
  }

  return { discountPercent: 0, discountAmount: 0 };
}

/**
 * Mensaje si el descuento queda fuera de rango (red de seguridad).
 * Con clamp en el input no debería aparecer en la UI.
 */
export function discountValidationMessage(
  mode: DiscountMode,
  discountPercent: number,
  discountAmount: number,
  subtotal = 0,
): string {
  if (mode === 'percent') {
    const percent = Number(discountPercent);
    if (!Number.isFinite(percent)) return 'El descuento no es válido';
    if (percent < 0) return 'El descuento no puede ser negativo';
    if (percent > DISCOUNT_PERCENT_MAX) {
      return `El descuento no puede superar el ${DISCOUNT_PERCENT_MAX}%`;
    }
  }
  if (mode === 'amount') {
    const amount = Number(discountAmount);
    if (!Number.isFinite(amount)) return 'El descuento no es válido';
    if (amount < 0) return 'El descuento no puede ser negativo';
    if (subtotal > 0 && amount >= subtotal) {
      return 'El descuento no puede ser mayor o igual al subtotal';
    }
  }
  return '';
}
