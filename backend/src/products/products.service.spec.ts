import { ProductType } from '../common/enums';
import { Product } from '../common/interfaces';
import { ProductRepository } from '../store/repositories/product.repository';
import { StoreService } from '../store/store.service';
import { ProductPricingService } from './product-pricing.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const baseProduct = (): Product => ({
    id: 'prod-1',
    name: 'Test',
    type: ProductType.FDM,
    images: [],
    updatedAt: '2026-07-01T10:00:00.000Z',
    price: 1000,
    cost: 500,
    profit: 500,
    categoryIds: ['cat-1'],
    size: '10 cm',
    published: true,
    components: [],
    assemblyTimeHours: 0,
    grams: 50,
    printTimeHours: 2,
    workTimeHours: 1,
  });

  function createService(store: StoreService) {
    const pricing = {
      resolvePricing: jest.fn((input: { price?: number; cost?: number }) => ({
        price: input.price ?? 1000,
        cost: input.cost ?? 500,
        profit: (input.price ?? 1000) - (input.cost ?? 500),
        breakdown: {},
      })),
      toPricingInput: jest.fn((input: unknown) => input),
    } as unknown as ProductPricingService;

    return new ProductsService(store, new ProductRepository(store), pricing);
  }

  it('despublica un producto con published=false', () => {
    const store = new StoreService();
    store.applyState({
      generalSettings: {} as never,
      products: [baseProduct()],
      categories: [
        {
          id: 'cat-1',
          name: 'Cat',
          productTypes: [ProductType.FDM],
          createdAt: '2026-07-01T10:00:00.000Z',
        },
      ],
      customers: [],
      orders: [],
      printJobs: [],
      retailSales: [],
      supplies: [],
      materials: [],
      impresos: [],
    });
    store.indexProduct(store.products[0]!);

    const service = createService(store);
    const updated = service.update('prod-1', { published: false });

    expect(updated.published).toBe(false);
    expect(service.findOne('prod-1').published).toBe(false);
  });

  it('devuelve overview de producto con categorías y catálogo', () => {
    const store = new StoreService();
    const product = baseProduct();
    store.applyState({
      generalSettings: {} as never,
      products: [product],
      categories: [
        {
          id: 'cat-1',
          name: 'Cat',
          productTypes: [ProductType.FDM],
          createdAt: '2026-07-01T10:00:00.000Z',
        },
      ],
      customers: [],
      orders: [],
      printJobs: [],
      retailSales: [],
      supplies: [],
      impresos: [],
      materials: [],
    });
    store.indexProduct(product);

    const service = createService(store);
    const overview = service.getOverview('prod-1');

    expect(overview.product.id).toBe('prod-1');
    expect(overview.categories).toHaveLength(1);
    expect(overview.catalogProducts).toHaveLength(1);
  });
});
