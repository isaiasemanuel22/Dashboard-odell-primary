import { Product, ProductType } from '../../core/models';
import { resolveProductUnitCost, resolveProductUnitPrice } from './product.helpers';

describe('resolveProductUnitCost con armado e insumos', () => {
  const pieceA = { id: 'a', type: ProductType.FDM, cost: 2000 } as Product;
  const pieceB = { id: 'b', type: ProductType.FDM, cost: 3612 } as Product;
  const combo = {
    id: 'c',
    type: ProductType.COMBO,
    cost: 6612,
    assemblyTimeHours: 1,
    components: [
      { productId: 'a', quantity: 1 },
      { productId: 'b', quantity: 1 },
    ],
  } as unknown as Product;
  const catalog = [pieceA, pieceB, combo];

  it('sin opciones suma solo las piezas', () => {
    expect(resolveProductUnitCost(combo, catalog)).toBe(5612);
  });

  it('con tarifa suma el armado: 5.612 + 1 h × 1.000 = 6.612 (sin falso aviso)', () => {
    expect(
      resolveProductUnitCost(combo, catalog, new Set(), { laborCostPerHour: 1000 }),
    ).toBe(6612);
  });

  it('suma los insumos propios del combo', () => {
    const withSupplies = {
      ...combo,
      supplies: [{ supplyId: 's1', quantity: 2 }],
    } as unknown as Product;
    expect(
      resolveProductUnitCost(withSupplies, [pieceA, pieceB, withSupplies], new Set(), {
        laborCostPerHour: 1000,
        supplyUnitPrice: () => 100,
      }),
    ).toBe(6812);
  });

  it('el precio del combo suma armado e insumos × 1,5 (§16.1.3)', () => {
    const a = { id: 'a', type: ProductType.FDM, price: 3000 } as Product;
    const b = { id: 'b', type: ProductType.FDM, price: 4000 } as Product;
    const c = {
      id: 'c',
      type: ProductType.COMBO,
      assemblyTimeHours: 1,
      supplies: [{ supplyId: 's1', quantity: 2 }],
      components: [
        { productId: 'a', quantity: 1 },
        { productId: 'b', quantity: 1 },
      ],
    } as unknown as Product;
    const cat = [a, b, c];
    expect(resolveProductUnitPrice(c, cat)).toBe(7000);
    expect(
      resolveProductUnitPrice(c, cat, new Set(), {
        laborCostPerHour: 1000,
        supplyUnitPrice: () => 100,
      }),
    ).toBe(7000 + 1000 + 300);
  });
});
