import {
  hasProductDiscount,
  productDiscountLabel,
  productSalePrice,
} from './product-discount.util';
import { wholesalePriceFromList } from './wholesale-example.util';

describe('product-discount.util', () => {
  it('lista $10.000 con 15 % da venta $8.500', () => {
    expect(productSalePrice({ price: 10000, discountPercent: 15 })).toBe(8500);
  });

  it('monto fijo $1.000 sobre $5.000 da $4.000', () => {
    expect(productSalePrice({ price: 5000, discountAmount: 1000 })).toBe(4000);
  });

  it('sin descuento devuelve la lista y limita el monto a lista − 1', () => {
    expect(productSalePrice({ price: 1234 })).toBe(1234);
    expect(productSalePrice({ price: 500, discountAmount: 900 })).toBe(1);
    expect(hasProductDiscount({ discountPercent: 0, discountAmount: null })).toBeFalse();
  });

  it('arma la etiqueta en % o en pesos', () => {
    expect(productDiscountLabel({ discountPercent: 15 })).toBe('−15 %');
    expect(productDiscountLabel({ discountAmount: 1000 }, (v) => `$${v}`)).toBe('−$1000');
    expect(productDiscountLabel({})).toBe('');
  });
  it('mayorista 20 % sobre la venta $8.500 da $6.800 y respeta el piso costo + 10 %', () => {
    const sale = productSalePrice({ price: 10000, discountPercent: 15 });
    expect(wholesalePriceFromList(sale, 20, 1000)).toBe(6800);
    expect(wholesalePriceFromList(sale, 20, 7000)).toBe(7700);
    expect(wholesalePriceFromList(sale, 20, 9000)).toBe(8500);
  });
});
