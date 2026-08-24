import { OrderStatus, ProductType, ServiceType } from '../common/enums';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import {
  OrderRepository,
  ProductRepository,
  RetailSaleRepository,
} from '../store/repositories';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { isRevenueOrder } from './sales-order.util';
import { SalesService } from './sales.service';

describe('SalesService order revenue', () => {
  let store: StoreService;
  let service: SalesService;

  beforeEach(() => {
    store = new StoreService();
    store.applyState(createEmptyState());
    const retailSales = new RetailSaleRepository(store);
    const orders = new OrderRepository(store);
    const products = new ProductRepository(store);
    service = new SalesService(
      retailSales,
      orders,
      products,
      {
        resolveCatalogUnitCost: () => 0,
        resolveCatalogUnitPrice: () => 100,
        resolveDesignUnitCost: () => 0,
      } as CostCalculatorService,
    );
  });

  it('solo incluye pedidos entregados en el listado de ventas', () => {
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 15, 18, 0, 0).toISOString();

    store.orders.push(
      {
        id: 'ord-completed',
        customerId: 'cust-1',
        customerName: 'Ana',
        services: [ServiceType.IMPRESION_3D],
        items: [
          {
            serviceType: ServiceType.IMPRESION_3D,
            productName: 'Pieza',
            quantity: 1,
            unitPrice: 1000,
          },
        ],
        status: OrderStatus.COMPLETADO,
        total: 1000,
        createdAt: dueDate,
        dueDate,
      },
      {
        id: 'ord-delivered',
        customerId: 'cust-1',
        customerName: 'Bruno',
        services: [ServiceType.IMPRESION_3D],
        items: [
          {
            serviceType: ServiceType.IMPRESION_3D,
            productName: 'Pieza',
            quantity: 1,
            unitPrice: 2500,
          },
        ],
        status: OrderStatus.ENTREGADO,
        total: 2500,
        createdAt: dueDate,
        dueDate,
      },
    );

    const { entries, stats } = service.getOverview();
    const orderEntries = entries.filter((entry) => entry.orderId);

    expect(isRevenueOrder(store.orders[0]!)).toBe(false);
    expect(isRevenueOrder(store.orders[1]!)).toBe(true);
    expect(orderEntries).toHaveLength(1);
    expect(orderEntries[0].orderId).toBe('ord-delivered');
    expect(stats.monthlyOrdersRevenue).toBe(2500);
    expect(stats.monthlyOrdersCount).toBe(1);
  });

  it('valida y descuenta stock en ventas retail', () => {
    store.products.push({
      id: 'prod-stock',
      name: 'Producto terminado',
      type: ProductType.COMBO,
      images: [],
      attachments: [],
      updatedAt: new Date().toISOString(),
      price: 100,
      cost: 50,
      profit: 50,
      categoryIds: [],
      size: 'u',
      published: true,
      includesPieces: true,
      components: [],
      assemblyTimeHours: 0,
      stock: 2,
    });
    service.createRetail({
      items: [{ productId: 'prod-stock', quantity: 2, unitPrice: 0 }],
    });

    expect(store.products[0].stock).toBe(0);
    service.createRetail({
      items: [{ productId: 'prod-stock', quantity: 1, unitPrice: 0 }],
    });
    expect(store.products[0].stock).toBe(0);
  });
});
