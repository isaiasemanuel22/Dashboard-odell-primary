import { ConflictException } from '@nestjs/common';
import {
  FilamentType,
  OrderStatus,
  ProductType,
  QuoteStatus,
} from '../common/enums';
import { Product } from '../common/interfaces';
import { ProductRepository } from '../store/repositories/product.repository';
import { StoreService } from '../store/store.service';
import { ProductPricingService } from './product-pricing.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const baseProduct = (overrides: Partial<Product> = {}): Product =>
    ({
      id: 'prod-1',
      name: 'Test',
      type: ProductType.FDM,
      images: [],
      attachments: [],
      updatedAt: '2026-07-01T10:00:00.000Z',
      price: 1000,
      cost: 500,
      profit: 500,
      categoryIds: ['cat-1'],
      size: '10 cm',
      published: true,
      components: [],
      assemblyTimeHours: 0,
      includesPieces: false,
      grams: 50,
      printTimeHours: 2,
      workTimeHours: 1,
      filamentType: FilamentType.PLA,
      ...overrides,
    }) as Product;

  function createService(
    store: StoreService,
    extras?: {
      pricingSync?: {
        syncAfterProductSave?: jest.Mock;
        syncCatalogPriceChanges?: jest.Mock;
        syncAllProductsAndOrders?: jest.Mock;
      };
      costMargins?: Record<string, number>;
    },
  ) {
    const pricing = {
      resolvePricing: jest.fn((input: { price?: number; cost?: number }) => ({
        price: input.price ?? 1000,
        cost: input.cost ?? 500,
        profit: (input.price ?? 1000) - (input.cost ?? 500),
        breakdown: {},
      })),
      toPricingInput: jest.fn((input: unknown) => input),
      productToPricingInput: jest.fn((product: Product) => ({
        type: product.type,
        price: product.price,
        cost: product.cost,
        suggestedPrice: product.suggestedPrice,
      })),
    } as unknown as ProductPricingService;

    const costCalculator = {
      getMarginForProductType: jest.fn((type: ProductType) => {
        if (type === ProductType.ESTAMPADO) {
          return extras?.costMargins?.estampado ?? 35;
        }
        return extras?.costMargins?.impresion_3d ?? 40;
      }),
    };

    return new ProductsService(
      store,
      new ProductRepository(store),
      pricing,
      {
        syncAfterProductSave: jest.fn(),
        syncCatalogPriceChanges: jest.fn(),
        syncAllProductsAndOrders: jest.fn(),
        ...extras?.pricingSync,
      } as never,
      { recordChange: jest.fn() } as never,
      costCalculator as never,
    );
  }

  function seedStore(store: StoreService, products: Product[]) {
    store.applyState({
      generalSettings: {
        profitMargins: {
          impresion_3d: 40,
          diseno_grafico: 50,
          modelado: 50,
          estampado: 35,
        },
        wholesaleDiscount: {
          enabled: true,
          percent: 20,
          serviceTypes: ['impresion_3d', 'estampado'],
        },
      } as never,
      products,
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
      brands: [],
      quotes: [],
      treasuryExpenses: [],
      calendarEntries: [],
      suppliers: [],
      spools: [],
      supplyMovements: [],
    });
    for (const product of products) {
      store.indexProduct(product);
    }
  }

  it('despublica un producto con published=false', () => {
    const store = new StoreService();
    seedStore(store, [baseProduct()]);
    const service = createService(store);
    const updated = service.update('prod-1', { published: false });

    expect(updated.published).toBe(false);
    expect(service.findOne('prod-1').published).toBe(false);
  });

  it('rechaza guardar un FDM con precio y sin tipo de filamento', () => {
    const store = new StoreService();
    const product = baseProduct();
    delete (product as { filamentType?: FilamentType }).filamentType;
    seedStore(store, [product]);
    const service = createService(store);

    expect(() =>
      service.update('prod-1', { price: 3500, grams: 10, filaments: [] }),
    ).toThrow(
      'Indicá los gramos y el tipo de material. El costo de un producto de impresión 3D sale de eso. No se puede guardar solo con el precio.',
    );
  });

  it('update respeta el precio que manda el cliente y sin precio deja el actual', () => {
    const store = new StoreService();
    seedStore(store, [baseProduct({ price: 1234, cost: 500 })]);
    const service = createService(store);

    const renamed = service.update('prod-1', { description: 'x' });
    expect(renamed.price).toBe(1234);

    const repriced = service.update('prod-1', { price: 2222 });
    expect(repriced.price).toBe(2222);
  });

  it('rechaza con 409 nombres duplicados al crear o renombrar', () => {
    const store = new StoreService();
    seedStore(store, [
      baseProduct({ id: 'prod-1', name: 'Árbol de equilibrio' }),
      baseProduct({ id: 'prod-2', name: 'Otro' }),
    ]);
    const service = createService(store);

    expect(() =>
      service.update('prod-2', { name: '  arbol DE equilibrio ' }),
    ).toThrow(ConflictException);
    expect(() =>
      service.create({
        ...baseProduct(),
        name: 'ARBOL de equilibrio',
      }),
    ).toThrow(ConflictException);
    // Guardar sin cambiar el nombre no choca consigo mismo.
    expect(() => service.update('prod-1', { description: 'ok' })).not.toThrow();
  });

  it('DELETE responde 409 si el producto está en pedidos sin cerrar o presupuestos abiertos', () => {
    const store = new StoreService();
    seedStore(store, [baseProduct()]);
    const service = createService(store);
    const line = { productId: 'prod-1', quantity: 1 } as never;

    store.orders.push({
      id: 'ord-1',
      status: OrderStatus.PENDIENTE,
      items: [line],
    } as never);
    expect(() => service.remove('prod-1')).toThrow(ConflictException);

    store.orders[0].status = OrderStatus.ENTREGADO;
    store.quotes.push({
      id: 'quo-1',
      status: QuoteStatus.BORRADOR,
      items: [line],
    } as never);
    expect(() => service.remove('prod-1')).toThrow(ConflictException);

    store.quotes[0].status = QuoteStatus.ACEPTADO;
    expect(() => service.remove('prod-1')).not.toThrow();
  });

  it('piezas candidatas excluyen las que generarían un ciclo', () => {
    const store = new StoreService();
    seedStore(store, [
      baseProduct({ id: 'a', name: 'A' }),
      baseProduct({
        id: 'b',
        name: 'B',
        type: ProductType.COMBO,
        components: [{ productId: 'a', quantity: 1 }],
      }),
      baseProduct({ id: 'c', name: 'C' }),
    ]);
    const service = createService(store);

    expect(service.getComponentCandidates('a').map((p) => p.id)).toEqual(['c']);
    expect(service.getComponentCandidates().map((p) => p.id)).toHaveLength(3);
  });

  it('devuelve overview de producto con categorías y catálogo', () => {
    const store = new StoreService();
    seedStore(store, [baseProduct()]);
    const service = createService(store);
    const overview = service.getOverview('prod-1');

    expect(overview.product.id).toBe('prod-1');
    expect(overview.categories).toHaveLength(1);
    expect(overview.catalogProducts).toHaveLength(1);
    expect(overview.stock).toEqual({
      physical: 0,
      reserved: 0,
      available: 0,
    });
  });

  it('lista alertas de margen por debajo del objetivo, ordenadas ascendente', () => {
    const store = new StoreService();
    seedStore(store, [
      baseProduct({
        id: 'prod-ok',
        name: 'Ok',
        price: 1400,
        cost: 1000,
        profit: 400,
        suggestedPrice: 1400,
      }),
      baseProduct({
        id: 'prod-low',
        name: 'Bajo',
        price: 1100,
        cost: 1000,
        profit: 100,
        suggestedPrice: 1100,
      }),
      baseProduct({
        id: 'prod-lower',
        name: 'Más bajo',
        price: 1050,
        cost: 1000,
        profit: 50,
        suggestedPrice: 1050,
      }),
    ]);

    const pricing = {
      resolvePricing: jest.fn((input: { price?: number; cost?: number }) => ({
        price: input.price ?? 0,
        cost: input.cost ?? 0,
        profit: (input.price ?? 0) - (input.cost ?? 0),
        breakdown: {},
      })),
      toPricingInput: jest.fn((input: unknown) => input),
      productToPricingInput: jest.fn((product: Product) => ({
        type: product.type,
        price: product.price,
        cost: product.cost,
        suggestedPrice: product.suggestedPrice,
      })),
    } as unknown as ProductPricingService;

    const service = new ProductsService(
      store,
      new ProductRepository(store),
      pricing,
      { syncAfterProductSave: jest.fn() } as never,
      { recordChange: jest.fn() } as never,
      {
        getMarginForProductType: () => 40,
      } as never,
    );

    const alerts = service.getMarginAlerts();
    expect(alerts.map((a) => a.productId)).toEqual(['prod-lower', 'prod-low']);
    expect(alerts[0].fixedPrice).toBe(true);
    expect(alerts[0].targetPercent).toBe(40);
    expect(alerts[0].priceForTarget).toBe(1400);
  });

  it('getMarginAlerts excluye productos no publicados', () => {
    const store = new StoreService();
    seedStore(store, [
      baseProduct({
        id: 'prod-draft',
        name: 'Prototipo funcional ABS',
        price: 500,
        cost: 1000,
        profit: -500,
        published: false,
        suggestedPrice: 500,
      }),
      baseProduct({
        id: 'prod-low',
        name: 'Bajo publicado',
        price: 1100,
        cost: 1000,
        profit: 100,
        published: true,
        suggestedPrice: 1100,
      }),
    ]);
    const service = createService(store);

    const alerts = service.getMarginAlerts();
    expect(alerts.map((a) => a.productId)).toEqual(['prod-low']);
  });

  it('preview de precios en bloque no guarda y solo incluye precio fijo', () => {
    const store = new StoreService();
    seedStore(store, [
      baseProduct({
        id: 'fixed',
        name: 'Fijo',
        price: 1000,
        cost: 500,
        suggestedPrice: 1000,
      }),
      baseProduct({
        id: 'auto',
        name: 'Auto',
        price: 1400,
        cost: 1000,
        suggestedPrice: null,
      }),
    ]);
    const service = createService(store);

    const preview = service.previewBulkPrice({
      scope: 'all',
      percent: 10,
      roundTo: 100,
    });

    expect(preview.count).toBe(1);
    expect(preview.items[0].productId).toBe('fixed');
    expect(preview.items[0].newPrice).toBe(1100);
    expect(store.getProductById('fixed')?.price).toBe(1000);
  });

  it('apply guarda precios fijos y dispara sync con bulk_price', () => {
    const store = new StoreService();
    seedStore(store, [
      baseProduct({
        id: 'fixed',
        name: 'Fijo',
        price: 1000,
        cost: 500,
        suggestedPrice: 1000,
      }),
      baseProduct({
        id: 'auto',
        name: 'Auto',
        price: 1400,
        cost: 1000,
        suggestedPrice: null,
      }),
    ]);
    const syncCatalogPriceChanges = jest.fn();
    const service = createService(store, {
      pricingSync: { syncCatalogPriceChanges },
    });

    const result = service.applyBulkPrice({
      scope: 'all',
      percent: 10,
      roundTo: 100,
    });

    expect(result.count).toBe(1);
    const fixed = store.getProductById('fixed')!;
    expect(fixed.price).toBe(1100);
    expect(fixed.suggestedPrice).toBe(1100);
    expect(fixed.profit).toBe(600);
    expect(store.getProductById('auto')?.price).toBe(1400);
    expect(syncCatalogPriceChanges).toHaveBeenCalledTimes(1);
    expect(syncCatalogPriceChanges).toHaveBeenCalledWith(
      expect.any(Map),
      'bulk_price',
    );
  });

  it('valida categoryId y filamentType en bulk price', () => {
    const store = new StoreService();
    seedStore(store, [baseProduct({ suggestedPrice: 1000 })]);
    const service = createService(store);

    expect(() =>
      service.previewBulkPrice({
        scope: 'category',
        categoryId: 'missing',
        percent: 10,
        roundTo: 0,
      }),
    ).toThrow('Categoría missing no encontrada');

    expect(() =>
      service.previewBulkPrice({
        scope: 'filament_type',
        percent: 10,
        roundTo: 0,
      } as never),
    ).toThrow('Indicá un tipo de filamento válido');

    expect(() =>
      service.previewBulkPrice({
        scope: 'all',
        percent: 0,
        roundTo: 100,
      }),
    ).toThrow('El porcentaje debe ser distinto de 0');
  });
});
