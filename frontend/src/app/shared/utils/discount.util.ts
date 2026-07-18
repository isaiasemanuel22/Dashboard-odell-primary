export type DiscountMode = 'none' | 'percent' | 'amount';

export interface DiscountInput {
  discountPercent?: number;
  discountAmount?: number;
}

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

export function calculateDiscountValue(
  subtotal: number,
  discountPercent = 0,
  discountAmount = 0,
): number {
  if (subtotal <= 0) return 0;

  const fixed = Math.max(discountAmount || 0, 0);
  if (fixed > 0) {
    return Math.min(Math.round(fixed), subtotal);
  }

  const percent = Math.min(Math.max(discountPercent || 0, 0), 100);
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
): DiscountInput {
  if (mode === 'percent') {
    return {
      discountPercent: Math.min(Math.max(discountPercent || 0, 0), 100),
      discountAmount: 0,
    };
  }

  if (mode === 'amount') {
    return {
      discountPercent: 0,
      discountAmount: Math.max(discountAmount || 0, 0),
    };
  }

  return { discountPercent: 0, discountAmount: 0 };
}
