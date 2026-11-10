import { ALL_STORE_COLLECTIONS, collectionsFromPath } from './route-registry';

describe('store.collections', () => {
  it('mapea rutas a colecciones dirty', () => {
    expect(collectionsFromPath('/api/orders')).toEqual([
      'orders',
      'printJobs',
      'products',
      'supplies',
      'supplyMovements',
    ]);
    expect(collectionsFromPath('/api/sales/retail')).toEqual([
      'retailSales',
      'products',
    ]);
    expect(collectionsFromPath('/api/settings/general')).toEqual([
      'settings',
      'brands',
      'supplies',
      'products',
    ]);
    expect(collectionsFromPath('/api/suppliers')).toEqual([
      'suppliers',
      'supplies',
    ]);
    expect(collectionsFromPath('/api/spools')).toEqual([
      'spools',
      'supplies',
      'supplyMovements',
      'printJobs',
    ]);
  });

  it('incluye todas las colecciones como fallback', () => {
    expect(collectionsFromPath('/api/unknown')).toEqual(ALL_STORE_COLLECTIONS);
  });
});
