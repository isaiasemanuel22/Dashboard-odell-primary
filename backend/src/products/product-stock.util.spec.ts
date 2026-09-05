import { OrderStatus, ProductType, ServiceType } from '../common/enums';
import { buildProductStockOverview } from './product-stock.util';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';

function baseProduct(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Producto',
    images: [],
    attachments: [],
    updatedAt: new Date().toISOString(),
    price: 1000,
    cost: 500,
    profit: 500,
    categoryIds: [],
    type: ProductType.FDM,
    size: '10cm',
    published: true,
    components: [],
    assemblyTimeHours: 0,
    grams: 50,
    printTimeHours: 1,
    workTimeHours: 0,
    stock: 0,
    ...overrides,
  };
}

describe('product-stock.util', () => {
  it('suma reservas activas y permite superar el stock físico', () => {
    const store = new StoreService();
    store.applyState(createEmptyState());
    store.products.push({
      id: 'prod-1',
      ...baseProduct({ name: 'Pieza', stock: 2 }),
    });
    store.orders.push({
      id: 'ord-1',
      customerId: 'cust-1',
      customerName: 'Cliente',
      services: [ServiceType.IMPRESION_3D],
      items: [
        {
          serviceType: ServiceType.IMPRESION_3D,
          productId: 'prod-1',
          productName: 'Pieza',
          quantity: 5,
          unitPrice: 1000,
          reservedQuantity: 5,
        },
      ],
      status: OrderStatus.PENDIENTE,
      total: 5000,
      createdAt: new Date().toISOString(),
      dueDate: new Date().toISOString(),
    });

    expect(buildProductStockOverview(store, 'prod-1')).toEqual({
      physical: 2,
      reserved: 5,
      available: 0,
    });
  });

  it('calcula stock compuesto según piezas disponibles', () => {
    const store = new StoreService();
    store.applyState(createEmptyState());
    store.products.push(
      {
        id: 'part-a',
        ...baseProduct({ name: 'Pieza A', stock: 5 }),
      },
      {
        id: 'part-b',
        ...baseProduct({ name: 'Pieza B', stock: 10 }),
      },
      {
        id: 'combo',
        ...baseProduct({
          name: 'Combo',
          type: ProductType.COMBO,
          includesPieces: true,
          stock: 3,
          components: [
            { productId: 'part-a', quantity: 2 },
            { productId: 'part-b', quantity: 1 },
          ],
        }),
      },
    );

    expect(buildProductStockOverview(store, 'combo')).toEqual({
      physical: 5,
      reserved: 0,
      available: 5,
    });
  });

  it('devuelve stock cero si las piezas no alcanzan aunque haya terminados', () => {
    const store = new StoreService();
    store.applyState(createEmptyState());
    store.products.push(
      {
        id: 'part-empty',
        ...baseProduct({ name: 'Pieza sin stock', stock: 0 }),
      },
      {
        id: 'combo-empty',
        ...baseProduct({
          name: 'Combo sin piezas',
          type: ProductType.COMBO,
          includesPieces: true,
          stock: 4,
          components: [{ productId: 'part-empty', quantity: 1 }],
        }),
      },
    );

    expect(buildProductStockOverview(store, 'combo-empty')).toEqual({
      physical: 0,
      reserved: 0,
      available: 0,
    });
  });
});
