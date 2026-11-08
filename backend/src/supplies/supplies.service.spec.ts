import {
  BrandMaterialType,
  ProductType,
  SupplyCategory,
} from '../common/enums';
import { Product, Supply } from '../common/interfaces';
import { DEFAULT_COLOR_CATALOG } from '../store/default-colors.seed';
import { StoreService } from '../store/store.service';
import { SupplyRepository } from '../store/repositories';
import { MAX_SUPPLY_PRICE_HISTORY } from './supply-price-history.util';
import { SuppliesService } from './supplies.service';

describe('SuppliesService', () => {
  function createService(store: StoreService) {
    return new SuppliesService(
      new SupplyRepository(store),
      store,
      { getUnitPriceForSupply: jest.fn() } as never,
      { recordChange: jest.fn() } as never,
      {
        notifySupplyAvailability: jest.fn(),
        blockTasksForDepletedSupply: jest.fn(() => false),
      } as never,
      { syncAllProductsAndOrders: jest.fn() } as never,
      { getReorder: jest.fn(), computeRows: jest.fn(() => []) } as never,
      undefined,
    );
  }

  function seed(
    store: StoreService,
    supplies: Supply[],
    products: Product[] = [],
  ) {
    store.applyState({
      generalSettings: {
        machineProfiles: [],
        colors: [...DEFAULT_COLOR_CATALOG],
      } as never,
      products,
      categories: [],
      customers: [],
      orders: [],
      printJobs: [],
      retailSales: [],
      supplies,
      impresos: [],
      brands: [
        {
          id: 'br-1',
          name: 'Odell',
          materialTypes: [BrandMaterialType.FILAMENT],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      quotes: [],
      treasuryExpenses: [],
      calendarEntries: [],
      suppliers: [],
      spools: [],
      supplyMovements: [],
    });
    for (const supply of supplies) {
      store.indexSupply(supply);
    }
    for (const product of products) {
      store.indexProduct(product);
    }
  }

  const colorId = DEFAULT_COLOR_CATALOG[0]?.id ?? 'color-1';

  const baseSupply = (overrides: Partial<Supply> = {}): Supply => ({
    id: 'sup-1',
    name: 'Vinilo',
    category: SupplyCategory.ESTAMPADO,
    unit: 'u',
    quantity: 10,
    minStock: 2,
    unitPrice: 1000,
    priceFromSettings: false,
    colorId,
    priceHistory: [{ at: '2026-01-01T00:00:00.000Z', unitPrice: 1000 }],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('registra historial al crear y al editar el precio', () => {
    const store = new StoreService();
    seed(store, []);
    const service = createService(store);

    const created = service.create({
      name: 'Vinilo mate',
      category: SupplyCategory.ESTAMPADO,
      unit: 'u',
      quantity: 1,
      minStock: 0,
      unitPrice: 20000,
      priceFromSettings: false,
      colorId,
    });

    expect(created.priceHistory).toEqual([
      expect.objectContaining({ unitPrice: 20000 }),
    ]);

    const updated = service.update(created.id, { unitPrice: 22000 });
    expect(updated.priceHistory).toHaveLength(2);
    expect(updated.priceHistory?.at(-1)?.unitPrice).toBe(22000);
  });

  it('registra historial en compra con precio nuevo', () => {
    const store = new StoreService();
    seed(store, [baseSupply()]);
    const service = createService(store);

    const saved = service.recordPurchase('sup-1', {
      quantityDelta: 2,
      unitPrice: 1200,
    });

    expect(saved.unitPrice).toBe(1200);
    expect(saved.quantity).toBe(12);
    expect(saved.priceHistory?.at(-1)?.unitPrice).toBe(1200);
  });

  it('recorta el historial a 50 entradas', () => {
    const store = new StoreService();
    const history = Array.from(
      { length: MAX_SUPPLY_PRICE_HISTORY },
      (_, i) => ({
        at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
        unitPrice: 1000 + i,
      }),
    );
    seed(store, [baseSupply({ priceHistory: history, unitPrice: 1049 })]);
    const service = createService(store);

    const updated = service.update('sup-1', { unitPrice: 2000 });
    expect(updated.priceHistory).toHaveLength(MAX_SUPPLY_PRICE_HISTORY);
    expect(updated.priceHistory?.[0].unitPrice).toBe(1001);
    expect(updated.priceHistory?.at(-1)?.unitPrice).toBe(2000);
  });

  it('lista cambios de precio en el período con productos afectados', () => {
    const now = Date.now();
    const store = new StoreService();
    const supply = baseSupply({
      unitPrice: 1500,
      priceHistory: [
        {
          at: new Date(now - 120 * 24 * 60 * 60 * 1000).toISOString(),
          unitPrice: 1000,
        },
        {
          at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
          unitPrice: 1500,
        },
      ],
    });
    const product = {
      id: 'prod-e',
      name: 'Estampado',
      type: ProductType.ESTAMPADO,
      images: [],
      attachments: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
      price: 5000,
      cost: 2000,
      profit: 3000,
      categoryIds: [],
      size: 'A4',
      published: true,
      components: [],
      assemblyTimeHours: 0,
      includesPieces: false,
      workTimeHours: 1,
      prints: [],
      pressCycles: [],
      supplies: [{ id: 'es-1', supplyId: 'sup-1', quantity: 1 }],
    } as Product;

    seed(store, [supply], [product]);
    const service = createService(store);

    const rows = service.getPriceChanges(90);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      supplyId: 'sup-1',
      priceBefore: 1000,
      priceNow: 1500,
      affectedProducts: 1,
    });
    expect(rows[0].variationPercent).toBeCloseTo(50);
  });

  it('al dejar el stock en 0 pide bloquear las tareas que usan ese insumo', () => {
    const store = new StoreService();
    const orderTasks = {
      notifySupplyAvailability: jest.fn(),
      blockTasksForDepletedSupply: jest.fn(() => true),
    };
    const storeChange = { recordChange: jest.fn() };
    seed(store, [baseSupply({ quantity: 4 })]);
    const service = new SuppliesService(
      new SupplyRepository(store),
      store,
      { getUnitPriceForSupply: jest.fn() } as never,
      storeChange as never,
      orderTasks as never,
      { syncAllProductsAndOrders: jest.fn() } as never,
      { getReorder: jest.fn(), computeRows: jest.fn(() => []) } as never,
      undefined,
    );

    service.update('sup-1', { quantity: 0 });

    expect(orderTasks.blockTasksForDepletedSupply).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sup-1', quantity: 0 }),
    );
    expect(orderTasks.notifySupplyAvailability).not.toHaveBeenCalled();
    expect(storeChange.recordChange).toHaveBeenCalledWith(
      expect.objectContaining({ collections: ['printJobs'] }),
    );
  });

  it('excluye variación 0 en price-changes', () => {
    const now = Date.now();
    const store = new StoreService();
    seed(store, [
      baseSupply({
        unitPrice: 1000,
        priceHistory: [
          {
            at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
            unitPrice: 1000,
          },
        ],
      }),
    ]);
    const service = createService(store);
    expect(service.getPriceChanges(90)).toEqual([]);
  });
});
