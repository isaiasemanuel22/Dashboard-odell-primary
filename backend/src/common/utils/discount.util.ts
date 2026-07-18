import { BadRequestException } from '@nestjs/common';

export interface DiscountInput {
  discountPercent?: number;
  discountAmount?: number;
}

export interface NormalizedDiscount {
  discountPercent: number;
  discountAmount: number;
}

export function normalizeDiscountFields(input: DiscountInput): NormalizedDiscount {
  const discountPercent = Math.min(
    Math.max(Number(input.discountPercent) || 0, 0),
    100,
  );
  const discountAmount = Math.max(Number(input.discountAmount) || 0, 0);

  if (discountPercent > 0 && discountAmount > 0) {
    throw new BadRequestException(
      'Usá un solo tipo de descuento: porcentaje o monto fijo',
    );
  }

  return { discountPercent, discountAmount };
}

export function calculateItemsSubtotal(
  items: Array<{ quantity: number; unitPrice: number }>,
): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function calculateDiscountValue(
  subtotal: number,
  discount: NormalizedDiscount,
): number {
  if (subtotal <= 0) return 0;

  if (discount.discountAmount > 0) {
    return Math.min(Math.round(discount.discountAmount), subtotal);
  }

  if (discount.discountPercent > 0) {
    return Math.round(subtotal * (discount.discountPercent / 100));
  }

  return 0;
}

export function calculateTotalWithDiscount(
  subtotal: number,
  discount: NormalizedDiscount,
): number {
  const discountValue = calculateDiscountValue(subtotal, discount);
  return Math.max(0, Math.round(subtotal - discountValue));
}
