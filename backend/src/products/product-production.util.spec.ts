import { ProductType } from '../common/enums';
import {
  resolveProductGrams,
  resolveProductPrintTimeHours,
  resolveProductWorkTimeHours,
  roundProductionHours,
  sumComponentsProductionMetrics,
} from './product-production.util';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';

function baseProduct(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Producto',
    images: [],
    attachments: [],
    updatedAt: new Date().toISOString(),
    price: 1000,
    cost: 500,
    profit: 500,
    categoryIds: [],
    type: ProductType.FDM,
    size: '10cm',
    published: true,
    components: [],
    assemblyTimeHours: 0,
    grams: 50,
    printTimeHours: 2,
    workTimeHours: 0,
    stock: 0,
    ...overrides,
  };
}

describe('product-production.util', () => {
  it('redondea horas de producción a un decimal', () => {
    expect(roundProductionHours(13.54)).toBe(13.5);
    expect(roundProductionHours(13.55)).toBe(13.6);
    expect(roundProductionHours(3.166)).toBe(3.2);
  });

  it('suma gramos y horas de impresión de las piezas', () => {
    const store = new StoreService();
    store.applyState(createEmptyState());
    store.products.push(
      {
        id: 'part-a',
        ...baseProduct({ name: 'Base', grams: 55, printTimeHours: 4 }),
      },
      {
        id: 'part-b',
        ...baseProduct({ name: 'Tablero', grams: 35, printTimeHours: 2.5 }),
      },
      {
        id: 'part-c',
        ...baseProduct({ name: 'Pieza', grams: 4, printTimeHours: 0.25 }),
      },
      {
        id: 'combo',
        ...baseProduct({
          name: 'Combo',
          includesPieces: true,
          grams: 0,
          printTimeHours: 0,
          workTimeHours: 0,
          components: [
            { productId: 'part-a', quantity: 1 },
            { productId: 'part-b', quantity: 1 },
            { productId: 'part-c', quantity: 28 },
          ],
        }),
      },
    );

    expect(resolveProductGrams(store, 'combo')).toBe(55 + 35 + 4 * 28);
    expect(resolveProductPrintTimeHours(store, 'combo')).toBe(13.5);
  });

  it('calcula mano de obra como armado + mano de obra de piezas', () => {
    const store = new StoreService();
    store.applyState(createEmptyState());
    store.products.push(
      {
        id: 'part-a',
        ...baseProduct({ workTimeHours: 0.5 }),
      },
      {
        id: 'part-b',
        ...baseProduct({ workTimeHours: 0.3 }),
      },
      {
        id: 'part-c',
        ...baseProduct({ workTimeHours: 0.05 }),
      },
      {
        id: 'combo',
        ...baseProduct({
          includesPieces: true,
          assemblyTimeHours: 1,
          workTimeHours: 0,
          components: [
            { productId: 'part-a', quantity: 1 },
            { productId: 'part-b', quantity: 1 },
            { productId: 'part-c', quantity: 28 },
          ],
        }),
      },
    );

    expect(resolveProductWorkTimeHours(store, 'combo')).toBe(3.2);
  });

  it('devuelve los valores propios cuando el producto no tiene piezas', () => {
    const store = new StoreService();
    store.applyState(createEmptyState());
    store.products.push({
      id: 'solo',
      ...baseProduct({ grams: 80, printTimeHours: 5, workTimeHours: 1.2 }),
    });

    expect(resolveProductGrams(store, 'solo')).toBe(80);
    expect(resolveProductPrintTimeHours(store, 'solo')).toBe(5);
    expect(resolveProductWorkTimeHours(store, 'solo')).toBe(1.2);
  });

  it('calcula métricas desde un listado de componentes', () => {
    const store = new StoreService();
    store.applyState(createEmptyState());
    store.products.push(
      {
        id: 'part-a',
        ...baseProduct({ grams: 10, printTimeHours: 1, workTimeHours: 0.4 }),
      },
      {
        id: 'part-b',
        ...baseProduct({ grams: 5, printTimeHours: 0.5, workTimeHours: 0.2 }),
      },
    );

    expect(
      sumComponentsProductionMetrics(
        store,
        [
          { productId: 'part-a', quantity: 2 },
          { productId: 'part-b', quantity: 3 },
        ],
        { assemblyTimeHours: 0.5 },
      ),
    ).toEqual({
      grams: 10 * 2 + 5 * 3,
      printTimeHours: 3.5,
      workTimeHours: 1.9,
    });
  });
});
