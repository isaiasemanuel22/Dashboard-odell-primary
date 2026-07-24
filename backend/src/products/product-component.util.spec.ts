import { normalizeProductComponents } from './product-component.util';

describe('normalizeProductComponents', () => {
  const catalog = [
    { id: 'prod-7', name: 'Base árbol de equilibrio' },
    { id: 'prod-8', name: 'Tablero árbol de equilibrio' },
    { id: 'prod-9', name: 'Pieza juego árbol' },
  ];

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

  it('resuelve piezas legacy guardadas solo con nombre', () => {
    expect(
      normalizeProductComponents(
        [
          { name: 'Base árbol de equilibrio', quantity: 1 },
          { name: 'Tablero árbol de equilibrio', quantity: 1 },
          { name: 'Pieza juego árbol', quantity: 28 },
        ],
        catalog,
      ),
    ).toEqual([
      { productId: 'prod-7', quantity: 1 },
      { productId: 'prod-8', quantity: 1 },
      { productId: 'prod-9', quantity: 28 },
    ]);
  });

  it('acepta product como id de pieza', () => {
    expect(
      normalizeProductComponents([{ product: 'prod-7', quantity: 2 }]),
    ).toEqual([{ productId: 'prod-7', quantity: 2 }]);
  });
});
