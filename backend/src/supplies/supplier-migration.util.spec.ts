import { SupplyCategory } from '../common/enums';
import { StoreState } from '../store/store.state';
import { adoptLegacySuppliers } from './supplier-migration.util';

function emptyState(overrides: Partial<StoreState> = {}): StoreState {
  return {
    generalSettings: {} as never,
    brands: [],
    supplies: [],
    impresos: [],
    categories: [],
    products: [],
    customers: [],
    orders: [],
    quotes: [],
    printJobs: [],
    retailSales: [],
    treasuryExpenses: [],
    calendarEntries: [],
    suppliers: [],
    spools: [],
    supplyMovements: [],
    ...overrides,
  };
}

describe('adoptLegacySuppliers', () => {
  it('crea proveedores y vincula de forma idempotente', () => {
    const state = emptyState({
      supplies: [
        {
          id: 'sup-1',
          name: 'PLA Negro',
          category: SupplyCategory.FDM,
          unit: 'kg',
          quantity: 2,
          minStock: 0,
          unitPrice: 1,
          priceFromSettings: false,
          supplier: 'FilAr',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'sup-2',
          name: 'PLA Blanco',
          category: SupplyCategory.FDM,
          unit: 'kg',
          quantity: 1,
          minStock: 0,
          unitPrice: 1,
          priceFromSettings: false,
          supplier: 'filar',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    adoptLegacySuppliers(state);
    expect(state.suppliers).toHaveLength(1);
    expect(state.suppliers[0].name).toBe('FilAr');
    expect(state.suppliers[0].leadTimeBusinessDays).toBe(3);
    expect(state.supplies[0].supplierId).toBe(state.suppliers[0].id);
    expect(state.supplies[1].supplierId).toBe(state.suppliers[0].id);
    expect(state.supplies[1].supplier).toBe('FilAr');

    adoptLegacySuppliers(state);
    expect(state.suppliers).toHaveLength(1);
  });
});
