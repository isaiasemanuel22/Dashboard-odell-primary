import {
  buildProductDuplicatePayload,
  duplicateName,
  uniqueDuplicateName,
} from './product-duplicate.util';
import type { Product } from '../../core/models';

describe('product-duplicate.util', () => {
  const fdm = {
    id: 'prod-1',
    name: 'Maceta',
    type: 'fdm',
    stock: 5,
    finishedStock: 3,
    published: true,
    price: 2000,
    cost: 900,
    profit: 1100,
    updatedAt: '2026-01-01',
    stockOverview: { physical: 5, reserved: 0, available: 5 },
    suggestedPrice: 1234,
    discountPercent: 10,
    categoryIds: ['c1'],
    images: ['https://x/i.png'],
    attachments: [
      { id: 'a1', name: 'm.3mf', url: 'u', mimeType: 'm', size: 3, extra: 1 },
    ],
    includesPieces: false,
    components: [],
    assemblyTimeHours: 0,
    grams: 50,
    printTimeHours: 2,
    workTimeHours: 1,
    filaments: [{ id: 'f1', filamentType: 'PLA', grams: 50, source: '3mf' }],
    supplies: [{ supplyId: 's1', quantity: 2 }],
  } as unknown as Product;

  it('arma el payload de la copia: nombre, stock 0, sin publicar, sin campos ajenos al DTO', () => {
    const p = buildProductDuplicatePayload(fdm) as any;
    expect(p.name).toBe('Maceta (copia)');
    expect(p.stock).toBe(0);
    expect(p.published).toBeFalse();
    expect(p.id).toBeUndefined();
    expect(p.updatedAt).toBeUndefined();
    expect(p.profit).toBeUndefined();
    expect(p.stockOverview).toBeUndefined();
    expect(p.finishedStock).toBeUndefined();
    expect(p.suggestedPrice).toBe(1234);
    expect(p.discountPercent).toBe(10);
    expect(p.price).toBe(2000);
    expect(p.supplies).toEqual([{ supplyId: 's1', quantity: 2 }]);
    expect(p.filaments[0].source).toBeUndefined();
    expect(p.attachments[0].extra).toBeUndefined();
  });

  it('combo: copia componentes y queda sin publicar', () => {
    const combo = {
      id: 'c',
      name: 'Kit',
      type: 'combo',
      price: 10,
      cost: 5,
      published: true,
      includesPieces: true,
      components: [{ productId: 'p2', quantity: 2, colorId: 'x' }],
      categoryIds: [],
      images: [],
      attachments: [],
      supplies: [{ id: 'l1', supplyId: 'caja', quantity: 1 }],
    } as unknown as Product;
    const p = buildProductDuplicatePayload(combo) as any;
    expect(p.components).toEqual([
      { productId: 'p2', quantity: 2, colorId: 'x' },
    ]);
    expect(p.published).toBeFalse();
    expect(p.grams).toBeUndefined();
    expect(p.supplies).toEqual([{ id: 'l1', supplyId: 'caja', quantity: 1 }]);
  });

  it('no muta el original', () => {
    buildProductDuplicatePayload(fdm);
    expect(fdm.id).toBe('prod-1');
    expect(fdm.name).toBe('Maceta');
    expect(fdm.published).toBeTrue();
    expect((fdm as any).filaments[0].source).toBe('3mf');
  });

  it('no repite el sufijo y evita nombres existentes', () => {
    expect(duplicateName('Maceta')).toBe('Maceta (copia)');
    expect(duplicateName('Maceta (copia)')).toBe('Maceta (copia 2)');
    expect(duplicateName('Maceta (copia 2)')).toBe('Maceta (copia 3)');
    expect(
      uniqueDuplicateName('Maceta', ['Maceta (copia)', 'maceta (copia 2)']),
    ).toBe('Maceta (copia 3)');
  });
});
