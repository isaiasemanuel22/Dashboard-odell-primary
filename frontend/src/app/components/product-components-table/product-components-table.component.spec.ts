import { Product, ProductType } from '../../core/models';
import { ProductComponentsTableComponent } from './product-components-table.component';

describe('ProductComponentsTableComponent (packaging de piezas, §27.4)', () => {
  // Pieza con costo guardado 4911 que incluye 1000 de packaging.
  const piece = {
    id: 'p1',
    name: 'Pieza',
    type: ProductType.FDM,
    cost: 4911,
    price: 9000,
    packagingSupplies: [{ supplyId: 's1', quantity: 1 }],
  } as unknown as Product;
  const unitPriceOf = (id: string) => (id === 's1' ? 1000 : 0);

  function make(resolver?: (id: string) => number) {
    const table = new ProductComponentsTableComponent();
    table.catalog = [piece];
    table.components = [{ productId: 'p1', quantity: 2 }];
    table.supplyUnitPrice = resolver;
    return table;
  }

  it('sin precios de insumo (tilde prendido) muestra el costo con packaging', () => {
    const table = make();
    expect(table.getUnitCost('p1')).toBe(4911);
    expect(table.getLineCost(table.components[0])).toBe(9822);
  });

  it('con el tilde apagado muestra la pieza sin su packaging', () => {
    const table = make(unitPriceOf);
    expect(table.getUnitCost('p1')).toBe(3911);
    expect(table.getLineCost(table.components[0])).toBe(7822);
  });
});
