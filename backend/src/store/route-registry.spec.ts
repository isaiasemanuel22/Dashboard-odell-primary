import {
  actionFromHttpMethod,
  collectionsFromPath,
  idFromMutationPath,
  routeMutationMetaFromPath,
  shouldTrackHttpMutation,
} from './route-registry';

describe('route-registry', () => {
  it('resuelve colecciones y scopes por ruta', () => {
    expect(routeMutationMetaFromPath('/api/orders')).toEqual({
      collections: [
        'orders',
        'printJobs',
        'products',
        'supplies',
        'supplyMovements',
      ],
      scopes: ['orders', 'print-jobs', 'dashboard', 'sales', 'supplies'],
      entity: 'order',
    });
    expect(collectionsFromPath('/api/sales/retail')).toEqual([
      'retailSales',
      'products',
    ]);
  });

  it('detecta mutaciones HTTP rastreables', () => {
    expect(shouldTrackHttpMutation('/api/products', 'POST')).toBe(true);
    expect(
      shouldTrackHttpMutation('/api/products/preview-pricing', 'POST'),
    ).toBe(false);
    expect(
      shouldTrackHttpMutation('/api/products/bulk-price/preview', 'POST'),
    ).toBe(false);
    expect(
      shouldTrackHttpMutation('/api/products/bulk-price/apply', 'POST'),
    ).toBe(true);
    expect(shouldTrackHttpMutation('/api/products', 'GET')).toBe(false);
  });

  it('marca products, orders y quotes en bulk-price/apply', () => {
    expect(routeMutationMetaFromPath('/api/products/bulk-price/apply')).toEqual(
      {
        collections: ['products', 'orders', 'quotes', 'brands'],
        scopes: ['products', 'orders', 'quotes', 'dashboard', 'sales'],
        entity: 'product',
      },
    );
  });

  it('extrae id y acción', () => {
    expect(idFromMutationPath('/api/orders/ord-1')).toBe('ord-1');
    expect(actionFromHttpMethod('DELETE')).toBe('delete');
  });
});
