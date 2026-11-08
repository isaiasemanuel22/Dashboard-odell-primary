import { SupplyCategory } from '../common/enums';
import { StoreService } from '../store/store.service';
import { SuppliesReorderService } from './supplies-reorder.service';

describe('SuppliesReorderService', () => {
  function seed() {
    const store = new StoreService();
    store.applyState({
      generalSettings: { colors: [] } as never,
      brands: [],
      supplies: [
        {
          id: 'sup-1',
          name: 'PLA Negro FilAr',
          category: SupplyCategory.FDM,
          unit: 'kg',
          quantity: 1,
          minStock: 0.2,
          unitPrice: 1000,
          priceFromSettings: false,
          supplierId: 'suplr-1',
          supplier: 'FilAr',
          spoolGrams: 1000,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
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
      suppliers: [
        {
          id: 'suplr-1',
          name: 'FilAr',
          leadTimeBusinessDays: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      spools: [],
      supplyMovements: [],
    });
    return store;
  }

  it('calcula weeklyConsumption, insufficientData y status', () => {
    const store = seed();
    const now = new Date('2026-11-09T12:00:00.000-03:00');
    // 0.28 kg en 28 días → weekly = 0.07
    for (let i = 0; i < 4; i++) {
      store.supplyMovements.push({
        id: `smv-${i}`,
        supplyId: 'sup-1',
        delta: -0.07,
        grams: -70,
        reason: 'task',
        at: new Date(now.getTime() - (7 + i * 5) * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    // primer movimiento hace > 7 días
    store.supplyMovements[0].at = new Date(
      now.getTime() - 20 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const service = new SuppliesReorderService(store);
    const rows = service.computeRows(now);
    expect(rows).toHaveLength(1);
    expect(rows[0].weeklyConsumption).toBeCloseTo(0.07, 5);
    expect(rows[0].insufficientData).toBe(false);
    expect(rows[0].coversDays).toBeCloseTo(100, 0); // 1 / (0.07/7) = 100
    expect(rows[0].suggestedQuantity).toBeGreaterThanOrEqual(0);
  });

  it('marca insufficientData si el primer consumo tiene < 7 días', () => {
    const store = seed();
    const now = new Date('2026-11-09T12:00:00.000-03:00');
    store.supplyMovements.push({
      id: 'smv-1',
      supplyId: 'sup-1',
      delta: -0.1,
      reason: 'task',
      at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const rows = new SuppliesReorderService(store).computeRows(now);
    expect(rows[0].insufficientData).toBe(true);
  });
});
