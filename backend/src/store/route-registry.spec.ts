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
      collections: ['orders', 'printJobs'],
      scopes: ['orders', 'print-jobs', 'dashboard', 'sales'],
      entity: 'order',
    });
    expect(collectionsFromPath('/api/sales/retail')).toEqual(['retailSales']);
  });

  it('detecta mutaciones HTTP rastreables', () => {
    expect(shouldTrackHttpMutation('/api/products', 'POST')).toBe(true);
    expect(shouldTrackHttpMutation('/api/products/preview-pricing', 'POST')).toBe(
      false,
    );
    expect(shouldTrackHttpMutation('/api/settings/calculate-cost', 'POST')).toBe(
      false,
    );
    expect(shouldTrackHttpMutation('/api/products', 'GET')).toBe(false);
  });

  it('extrae id y acción', () => {
    expect(idFromMutationPath('/api/orders/ord-1')).toBe('ord-1');
    expect(actionFromHttpMethod('DELETE')).toBe('delete');
  });
});
