import { SupplyCategory } from '../common/enums';
import { StoreService } from '../store/store.service';
import { applyStockChange } from './apply-stock-change.util';

describe('applyStockChange', () => {
  it('cambia quantity y registra movimiento (compra / task)', () => {
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
});
