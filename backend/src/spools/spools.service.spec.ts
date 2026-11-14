import { BadRequestException } from '@nestjs/common';
import {
  MachineProfileRole,
  ProductType,
  SupplyCategory,
} from '../common/enums';
import { Spool, Supply } from '../common/interfaces';
import { StoreService } from '../store/store.service';
import { SuppliesReorderService } from '../supplies/supplies-reorder.service';
import { SpoolsService } from './spools.service';

describe('SpoolsService', () => {
  function seedStore(supplies: Supply[] = [], spools: Spool[] = []) {
    const store = new StoreService();
    store.applyState({
      generalSettings: {
        machineProfiles: [
          {
            id: 'mp-1',
            name: 'A1 #1',
            role: MachineProfileRole.PRINT,
            productType: ProductType.FDM,
            queueEnabled: true,
          },
        ],
        colors: [{ id: 'color-1', name: 'Negro', hex: '#000000' }],
      } as never,
      brands: [],
      supplies,
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
      spools,
      supplyMovements: [],
    });
    return store;
  }

  function filament(overrides: Partial<Supply> = {}): Supply {
    return {
      id: 'sup-1',
      name: 'PLA Negro',
      category: SupplyCategory.FDM,
      unit: 'kg',
      quantity: 2,
      minStock: 0,
      unitPrice: 1000,
      priceFromSettings: false,
      colorId: 'color-1',
      spoolGrams: 1000,
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function createService(store: StoreService) {
    return new SpoolsService(
      store,
      { recordChange: jest.fn() } as never,
      new SuppliesReorderService(store),
      { describeConsumption: jest.fn(() => []) } as never,
    );
  }

  it('abre bobina con stock cerrado y rechaza sin stock', () => {
    const store = seedStore([filament({ quantity: 1.2 })]);
    const service = createService(store);

    const opened = service.open({
      supplyId: 'sup-1',
      location: { kind: 'shelf', text: 'Estante A' },
    });
    expect(opened.code).toBe('B-01');
    expect(opened.remainingGrams).toBe(1000);

    expect(() =>
      service.open({
        supplyId: 'sup-1',
        location: { kind: 'shelf', text: 'Estante B' },
      }),
    ).toThrow(BadRequestException);
  });

  it('rechaza mover a ranura ocupada', () => {
    const store = seedStore([filament()]);
    const service = createService(store);
    const a = service.open({
      supplyId: 'sup-1',
      grams: 500,
      location: { kind: 'printer', printerId: 'mp-1', slot: 1 },
    });
    const b = service.open({
      supplyId: 'sup-1',
      grams: 500,
      location: { kind: 'shelf', text: 'Temp' },
    });
    expect(() =>
      service.move(b.id, {
        location: { kind: 'printer', printerId: 'mp-1', slot: 1 },
      }),
    ).toThrow(/ranura 1/);
    expect(a.id).toBeTruthy();
  });

  it('ajustar y terminar registran movimientos y stock', () => {
    const store = seedStore([filament({ quantity: 1 })]);
    const service = createService(store);
    const opened = service.open({
      supplyId: 'sup-1',
      grams: 1000,
      location: { kind: 'shelf', text: 'A' },
    });

    service.adjust(opened.id, { remainingGrams: 800 });
    expect(store.getSupplyById('sup-1')!.quantity).toBeCloseTo(0.8, 5);
    expect(store.supplyMovements.some((m) => m.reason === 'adjust')).toBe(true);

    service.finish(opened.id);
    const supply = store.getSupplyById('sup-1')!;
    expect(supply.quantity).toBeCloseTo(0, 5);
    expect(store.getSpoolById(opened.id)!.finishedAt).toBeTruthy();
    expect(
      store.supplyMovements.filter((m) => m.reason === 'adjust').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('allocate descuenta bobinas y cierra en 0', () => {
    const store = seedStore([filament({ quantity: 1 })]);
    const service = createService(store);
    const opened = service.open({
      supplyId: 'sup-1',
      grams: 100,
      location: { kind: 'printer', printerId: 'mp-1', slot: 2 },
    });
    const supply = store.getSupplyById('sup-1')!;
    service.allocate(
      supply,
      100,
      { id: 'job-1', printerId: 'mp-1' },
      {
        dryRun: false,
        reason: 'task',
      },
    );
    expect(store.getSpoolById(opened.id)!.finishedAt).toBeTruthy();
    expect(supply.quantity).toBeCloseTo(0.9, 5);
  });
});
