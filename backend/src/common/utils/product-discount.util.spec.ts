import { BadRequestException } from '@nestjs/common';
import {
  hasProductDiscount,
  normalizeProductDiscount,
  productSalePrice,
} from './product-discount.util';

describe('product-discount.util', () => {
  it('lista $10.000 con 15 % da venta $8.500', () => {
    expect(productSalePrice({ price: 10000, discountPercent: 15 })).toBe(8500);
  });

  it('monto fijo $1.000 sobre $5.000 da $4.000', () => {
    expect(productSalePrice({ price: 5000, discountAmount: 1000 })).toBe(4000);
  });

  it('sin descuento devuelve la lista tal cual', () => {
    expect(productSalePrice({ price: 1234.5 })).toBe(1234.5);
    expect(productSalePrice({ price: 100, discountPercent: null })).toBe(100);
    expect(hasProductDiscount({ discountPercent: 0 })).toBe(false);
  });

  it('redondea al peso y limita el monto a un peso menos que la lista', () => {
    expect(productSalePrice({ price: 999, discountPercent: 15 })).toBe(849);
    expect(productSalePrice({ price: 500, discountAmount: 900 })).toBe(1);
  });

  it('normaliza: no admite ambos ni porcentaje fuera de rango', () => {
    expect(() =>
      normalizeProductDiscount({ discountPercent: 10, discountAmount: 100 }),
    ).toThrow(BadRequestException);
    expect(() => normalizeProductDiscount({ discountPercent: 100 })).toThrow(
      BadRequestException,
    );
    expect(() =>
      normalizeProductDiscount({ discountAmount: 5000 }, 5000),
    ).toThrow(BadRequestException);
    expect(
      normalizeProductDiscount({ discountPercent: 0, discountAmount: null }),
    ).toEqual({ discountPercent: null, discountAmount: null });
  });
});
