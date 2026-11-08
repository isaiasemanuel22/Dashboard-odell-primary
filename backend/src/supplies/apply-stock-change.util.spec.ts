import { SupplyCategory } from '../common/enums';
import { StoreService } from '../store/store.service';
import {
  applyStockChange,
  applyStockChangeGrams,
  roundRemainingGrams,
  roundSupplyQuantity,
} from './apply-stock-change.util';

function emptyStore(): StoreService {
  const store = new StoreService();
  store.applyState({
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
  });
  return store;
}

describe('applyStockChange', () => {
  it('cambia quantity y registra movimiento (compra / task)', () => {
    const store = emptyStore();
    const supply = {
      id: 'sup-1',
      name: 'PLA',
      category: SupplyCategory.FDM,
      unit: 'kg',
      quantity: 1,
      minStock: 0,
      unitPrice: 1,
      priceFromSettings: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    store.supplies.push(supply);

    applyStockChange(store, supply, 0.5, 'purchase');
    expect(supply.quantity).toBeCloseTo(1.5, 5);
    expect(store.supplyMovements).toHaveLength(1);
    expect(store.supplyMovements[0].reason).toBe('purchase');

    applyStockChange(store, supply, -0.2, 'task', { jobId: 'job-1' });
    expect(supply.quantity).toBeCloseTo(1.3, 5);
    expect(store.supplyMovements[1].reason).toBe('task');
    expect(store.supplyMovements[1].jobId).toBe('job-1');
  });

  it('redondea basura de punto flotante a 6 decimales', () => {
    const store = emptyStore();
    const supply = {
      id: 'sup-2',
      name: 'PLA',
      category: SupplyCategory.FDM,
      unit: 'kg',
      quantity: 12.7,
      minStock: 0,
      unitPrice: 1,
      priceFromSettings: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    store.supplies.push(supply);

    applyStockChange(store, supply, 0.1 + 0.2 - 0.3, 'adjust');
    expect(supply.quantity).toBe(12.7);
    expect(String(supply.quantity)).not.toContain('000000');

    applyStockChangeGrams(store, supply, 100, 'purchase');
    expect(supply.quantity).toBe(12.8);
  });
});

describe('roundSupplyQuantity / roundRemainingGrams', () => {
  it('redondea quantity a 6 decimales y grams a 0,1', () => {
    expect(roundSupplyQuantity(12.700000000000001)).toBe(12.7);
    expect(roundRemainingGrams(250.04)).toBe(250);
    expect(roundRemainingGrams(250.06)).toBe(250.1);
  });
});
