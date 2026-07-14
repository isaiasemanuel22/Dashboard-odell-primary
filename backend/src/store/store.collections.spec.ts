import { ALL_STORE_COLLECTIONS, collectionsFromPath } from './route-registry';

describe('store.collections', () => {
  it('mapea rutas a colecciones dirty', () => {
    expect(collectionsFromPath('/api/orders')).toEqual(['orders', 'printJobs']);
    expect(collectionsFromPath('/api/sales/retail')).toEqual(['retailSales']);
    expect(collectionsFromPath('/api/settings/general')).toEqual([
      'settings',
      'supplies',
      'products',
    ]);
  });

  it('incluye todas las colecciones como fallback', () => {
    expect(collectionsFromPath('/api/unknown')).toEqual(ALL_STORE_COLLECTIONS);
  });
});
