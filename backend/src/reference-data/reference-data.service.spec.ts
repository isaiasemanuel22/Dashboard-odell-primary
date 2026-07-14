import { ProductType } from '../common/enums';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { ReferenceDataService } from './reference-data.service';

describe('ReferenceDataService', () => {
  it('devuelve clientes, categorías y productos', () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.customers.push({
      id: 'cust-1',
      name: 'Cliente',
      email: 'a@test.com',
      phone: '123',
      createdAt: '2026-07-01T10:00:00.000Z',
    });
    state.categories.push({
      id: 'cat-1',
      name: 'General',
      productTypes: [ProductType.FDM],
      createdAt: '2026-07-01T10:00:00.000Z',
    });
    store.applyState(state);

    const service = new ReferenceDataService(store);
    const data = service.getAll();

    expect(data.customers).toHaveLength(1);
    expect(data.categories).toHaveLength(1);
    expect(Array.isArray(data.products)).toBe(true);
  });
});
