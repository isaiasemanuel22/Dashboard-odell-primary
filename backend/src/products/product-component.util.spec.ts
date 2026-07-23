import { normalizeProductComponents } from './product-component.util';

describe('normalizeProductComponents', () => {
  it('preserva el formato estándar', () => {
    expect(
      normalizeProductComponents([
        { productId: 'prod-7', quantity: 2 },
      ]),
    ).toEqual([{ productId: 'prod-7', quantity: 2 }]);
  });

  it('acepta ids sueltos como strings', () => {
    expect(normalizeProductComponents(['prod-7', 'prod-8'])).toEqual([
      { productId: 'prod-7', quantity: 1 },
      { productId: 'prod-8', quantity: 1 },
    ]);
  });

  it('acepta alias legacy id/qty', () => {
    expect(
      normalizeProductComponents([{ id: 'prod-9', qty: 28 }]),
    ).toEqual([{ productId: 'prod-9', quantity: 28 }]);
  });

  it('convierte mapas productId → cantidad', () => {
    expect(
      normalizeProductComponents({
        'prod-7': 1,
        'prod-8': 2,
      }),
    ).toEqual([
      { productId: 'prod-7', quantity: 1 },
      { productId: 'prod-8', quantity: 2 },
    ]);
  });
});
