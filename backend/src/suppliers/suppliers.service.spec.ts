import { SupplyCategory } from '../common/enums';
import { StoreService } from '../store/store.service';
import { SuppliesReorderService } from '../supplies/supplies-reorder.service';
import { SuppliersService } from './suppliers.service';

describe('SuppliersService', () => {
  it('arma order-draft con texto copiable', () => {
    const store = new StoreService();
    store.applyState({
      generalSettings: {} as never,
      brands: [],
      supplies: [
        {
          id: 'sup-1',
          name: 'PLA Negro FilAr',
          category: SupplyCategory.FDM,
          unit: 'kg',
          quantity: 0.1,
          minStock: 1,
          unitPrice: 1,
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
      supplyMovements: [
        {
          id: 'smv-1',
          supplyId: 'sup-1',
          delta: -0.5,
          reason: 'task',
          at: '2026-10-20T00:00:00.000Z',
        },
        {
          id: 'smv-2',
          supplyId: 'sup-1',
          delta: -0.5,
          reason: 'task',
          at: '2026-10-27T00:00:00.000Z',
        },
      ],
    });

    const reorder = new SuppliesReorderService(store);
    const service = new SuppliersService(
      store,
      { recordChange: jest.fn() } as never,
      reorder,
    );
    const draft = service.orderDraft(
      'suplr-1',
      new Date('2026-11-09T12:00:00.000-03:00'),
    );
    expect(draft.supplier.name).toBe('FilAr');
    expect(draft.text.startsWith('Hola FilAr, necesito:')).toBe(true);
    expect(draft.lines.length).toBeGreaterThan(0);
    expect(draft.lines[0].name).toContain('PLA');
  });

  it('devuelve lines vacías y text vacío si no hay sugerencias', () => {
    const store = new StoreService();
    store.applyState({
      generalSettings: {} as never,
      brands: [],
      supplies: [
        {
          id: 'sup-1',
          name: 'PLA',
          category: SupplyCategory.FDM,
          unit: 'kg',
          quantity: 5,
          minStock: 0.2,
          unitPrice: 1,
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

    const reorder = new SuppliesReorderService(store);
    const service = new SuppliersService(
      store,
      { recordChange: jest.fn() } as never,
      reorder,
    );
    const draft = service.orderDraft(
      'suplr-1',
      new Date('2026-11-09T12:00:00.000-03:00'),
    );
    expect(draft.lines).toEqual([]);
    expect(draft.text).toBe('');
  });
});
