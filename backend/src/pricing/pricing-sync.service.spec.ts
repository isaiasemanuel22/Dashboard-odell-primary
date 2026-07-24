import { ProductType } from '../common/enums';
import { Product } from '../common/interfaces';
import { ProductPricingService } from '../products/product-pricing.service';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { OrderRepository, ProductRepository } from '../store/repositories';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { PricingSyncService } from './pricing-sync.service';

describe('PricingSyncService', () => {
  function createProduct(overrides: Partial<Product> & Pick<Product, 'id' | 'name'>): Product {
    return {
      id: overrides.id,
      name: overrides.name,
      type: ProductType.FDM,
      images: [],
      updatedAt: '2026-07-01T10:00:00.000Z',
      price: 0,
      cost: 0,
      profit: 0,
      categoryIds: [],
      size: '10 cm',
      published: true,
      components: [],
      assemblyTimeHours: 0,
      grams: 50,
      printTimeHours: 1,
      workTimeHours: 0,
      ...overrides,
    };
  }

  function createService(store: StoreService) {
    const costCalculator = new CostCalculatorService(store);
    const pricing = new ProductPricingService(costCalculator, store);
    const storeChange = {
      recordChange: jest.fn(),
    } as unknown as StoreChangeService;

    return {
      store,
      storeChange,
      service: new PricingSyncService(
        store,
        new ProductRepository(store),
        new OrderRepository(store),
        pricing,
        storeChange,
      ),
    };
  }

  it('recalcula ensamblados FDM aunque estén antes que sus piezas en el catálogo', () => {
    const store = new StoreService();
    store.applyState(createEmptyState());

    const pieceA = createProduct({
      id: 'piece-a',
      name: 'Base',
      price: 4694,
      cost: 1707,
      profit: 2987,
    });
    const pieceB = createProduct({
      id: 'piece-b',
      name: 'Tablero',
      price: 12337,
      cost: 4486,
      profit: 7851,
    });
    const pieceC = createProduct({
      id: 'piece-c',
      name: 'Pieza de juego',
      price: 355,
      cost: 129,
      profit: 226,
    });
    const assembly = createProduct({
      id: 'assembly-1',
      name: 'Arbol de equilibrio',
      includesPieces: true,
      price: 22190,
      cost: 14924,
      profit: 7266,
      components: [
        { productId: 'piece-a', quantity: 1 },
        { productId: 'piece-b', quantity: 1 },
        { productId: 'piece-c', quantity: 38 },
      ],
      assemblyTimeHours: 0.5,
      grams: 0,
      printTimeHours: 0,
      workTimeHours: 0,
    });

    store.products.push(assembly, pieceA, pieceB, pieceC);
    for (const product of store.products) {
      store.indexProduct(product);
    }

    pieceC.price = 400;
    pieceC.profit = 271;
    store.replaceProduct(pieceC);

    const { service } = createService(store);
    service.syncAfterProductSave('piece-c', 355);

    const updated = store.getProductById('assembly-1');
    expect(updated?.price).toBe(4694 + 12337 + 400 * 38);
    expect(updated?.price).not.toBe(22190);
  });

  it('propaga cambios de pieza a ensamblados FDM al guardar un componente', () => {
    const store = new StoreService();
    store.applyState(createEmptyState());

    const piece = createProduct({
      id: 'piece-a',
      name: 'Base',
      price: 1000,
      cost: 500,
      profit: 500,
    });
    const assembly = createProduct({
      id: 'assembly-1',
      name: 'Combo manual',
      includesPieces: true,
      price: 1500,
      cost: 600,
      profit: 900,
      components: [{ productId: 'piece-a', quantity: 2 }],
      grams: 0,
      printTimeHours: 0,
      workTimeHours: 0,
    });

    store.products.push(piece, assembly);
    for (const product of store.products) {
      store.indexProduct(product);
    }

    piece.price = 2000;
    piece.profit = 1500;
    store.replaceProduct(piece);

    const { service } = createService(store);
    service.syncAfterProductSave('piece-a', 1000);

    const updated = store.getProductById('assembly-1');
    expect(updated?.price).toBe(4000);
    expect(updated?.profit).toBe(updated!.price - updated!.cost);
  });
});
