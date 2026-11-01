import { BadRequestException } from '@nestjs/common';
import {
  calculateDiscountValue,
  calculateTotalWithDiscount,
  DISCOUNT_PERCENT_MAX,
  normalizeDiscountFields,
} from './discount.util';

describe('discount.util', () => {
  it('rechaza porcentaje y monto fijo a la vez', () => {
    expect(() =>
      normalizeDiscountFields({ discountPercent: 10, discountAmount: 50 }),
    ).toThrow(BadRequestException);
  });

  it('ajusta el porcentaje al rango 0–99', () => {
    expect(
      normalizeDiscountFields({ discountPercent: -5 }).discountPercent,
    ).toBe(0);
    expect(
      normalizeDiscountFields({ discountPercent: 100 }).discountPercent,
    ).toBe(DISCOUNT_PERCENT_MAX);
  });

  it('nunca deja el total en $0 con el descuento máximo', () => {
    const percent = normalizeDiscountFields({ discountPercent: 150 });
    expect(calculateTotalWithDiscount(1000, percent)).toBe(10);

    const amount = normalizeDiscountFields({ discountAmount: 5000 });
    expect(calculateDiscountValue(1000, amount)).toBe(999);
    expect(calculateTotalWithDiscount(1000, amount)).toBe(1);
  });

  it('aplica un monto fijo válido tal cual', () => {
    const amount = normalizeDiscountFields({ discountAmount: 250 });
    expect(calculateTotalWithDiscount(1000, amount)).toBe(750);
  });

  it('no descuenta si el subtotal es 0', () => {
    const amount = normalizeDiscountFields({ discountAmount: 250 });
    expect(calculateTotalWithDiscount(0, amount)).toBe(0);
  });
});
