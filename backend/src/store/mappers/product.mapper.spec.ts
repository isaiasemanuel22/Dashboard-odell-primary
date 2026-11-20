import { ProductType } from '../../common/enums';
import { mapProductFromDb, mapProductToDb } from './product.mapper';

const row = {
  id: 'prod-1',
  name: 'Pieza',
  description: null,
  images: [],
  updatedAt: new Date('2026-11-15T10:00:00.000Z'),
  price: 10000,
  cost: 1000,
  profit: 9000,
  categoryIds: [],
  type: ProductType.COMBO as string,
  size: 'Combo',
  published: true,
  components: [],
  assemblyTimeHours: 0,
  grams: null,
  printTimeHours: null,
  workTimeHours: null,
  brandId: null,
  filamentType: null,
  resinType: null,
  washMinutes: null,
  cureMinutes: null,
  pressMinutes: null,
  paperType: null,
  impresoId: null,
  widthCm: null,
  heightCm: null,
  includesPieces: true,
};

describe('product.mapper descuento', () => {
  it('hace round-trip del descuento en porcentaje', () => {
    const product = mapProductFromDb({ ...row, discountPercent: 15 });
    expect(product.discountPercent).toBe(15);
    expect(product.discountAmount).toBeNull();
    const db = mapProductToDb(product);
    expect(db.discountPercent).toBe(15);
    expect(db.discountAmount).toBeNull();
  });

  it('hace round-trip del monto fijo y tolera filas sin descuento', () => {
    const product = mapProductFromDb({ ...row, discountAmount: 1000 });
    expect(mapProductToDb(product).discountAmount).toBe(1000);

    const none = mapProductFromDb(row);
    expect(none.discountPercent).toBeNull();
    expect(none.discountAmount).toBeNull();
  });
});

describe('product.mapper precio fijo', () => {
  it('persiste y lee el precio fijo (suggestedPrice)', () => {
    const product = mapProductFromDb({ ...row, suggestedPrice: 25000 });
    expect(product.suggestedPrice).toBe(25000);
    expect(mapProductToDb(product).suggestedPrice).toBe(25000);
  });

  it('sin precio fijo queda en null', () => {
    const none = mapProductFromDb(row);
    expect(none.suggestedPrice).toBeNull();
    expect(mapProductToDb(none).suggestedPrice).toBeNull();
  });
});
