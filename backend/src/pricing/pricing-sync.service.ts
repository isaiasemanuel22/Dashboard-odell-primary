import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, ProductType } from '../common/enums';
import { Order, Product, Product3D } from '../common/interfaces';
import {
  calculateItemsSubtotal,
  calculateTotalWithDiscount,
  normalizeDiscountFields,
} from '../common/utils/discount.util';
import { appendOrderPriceHistory } from '../orders/order-price-history.util';
import type { OrderPriceChangeTrigger } from '../orders/order-price-history.util';
import { ProductPricingService } from '../products/product-pricing.service';
import { sumComponentsProductionMetrics } from '../products/product-production.util';
import { OrderRepository, ProductRepository } from '../store/repositories';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';

export interface ProductPriceChange {
  oldPrice: number;
  newPrice: number;
}

const ADJUSTABLE_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.PENDIENTE,
  OrderStatus.EN_PRODUCCION,
  OrderStatus.COMPLETADO,
]);

@Injectable()
export class PricingSyncService {
  private readonly logger = new Logger(PricingSyncService.name);

  constructor(
    private readonly store: StoreService,
    private readonly products: ProductRepository,
    private readonly orders: OrderRepository,
    private readonly pricing: ProductPricingService,
    private readonly storeChange: StoreChangeService,
  ) {}

  syncAllProductsAndOrders(trigger: OrderPriceChangeTrigger): void {
    const { priceChanges, recalculated } = this.recalculateAllProducts();
    this.syncOrderPrices(priceChanges, trigger);
    this.notifyChanges(recalculated || priceChanges.size > 0);
  }

  syncAfterProductSave(productId: string, previousPrice: number): void {
    const product = this.store.getProductById(productId);
    if (!product) return;

    const priceChanges = new Map<string, ProductPriceChange>();
    if (product.price !== previousPrice) {
      priceChanges.set(productId, {
        oldPrice: previousPrice,
        newPrice: product.price,
      });
    }

    const compositeRecalculated = this.recalculateCompositeProducts(priceChanges);
    this.syncOrderPrices(priceChanges, 'product_update');
    this.notifyChanges(priceChanges.size > 0 || compositeRecalculated);
  }

  private recalculateAllProducts(): {
    priceChanges: Map<string, ProductPriceChange>;
    recalculated: boolean;
  } {
    const priceChanges = new Map<string, ProductPriceChange>();
    let recalculated = false;

    for (const product of [...this.store.products]) {
      if (this.hasComponents(product)) continue;
      if (this.applyProductRecalc(product, priceChanges)) {
        recalculated = true;
      }
    }

    if (this.recalculateCompositeProducts(priceChanges)) {
      recalculated = true;
    }

    if (priceChanges.size > 0) {
      this.logger.log(
        `Precios recalculados en ${priceChanges.size} producto(s)`,
      );
    }

    return { priceChanges, recalculated };
  }

  private recalculateCompositeProducts(
    priceChanges: Map<string, ProductPriceChange>,
  ): boolean {
    let recalculated = false;
    for (let pass = 0; pass < 12; pass++) {
      let changed = false;
      for (const product of [...this.store.products]) {
        if (!this.hasComponents(product)) continue;
        if (this.applyProductRecalc(product, priceChanges)) {
          changed = true;
          recalculated = true;
        }
      }
      if (!changed) break;
    }
    return recalculated;
  }

  private hasComponents(product: Product): boolean {
    return (product.components ?? []).length > 0;
  }

  private applyProductRecalc(
    product: Product,
    priceChanges: Map<string, ProductPriceChange>,
  ): boolean {
    const current = this.store.getProductById(product.id);
    if (!current) return false;

    const result = this.pricing.resolvePricing(
      this.pricing.productToPricingInput(current),
    );
    const productionMetrics = this.resolveCompositeProductionMetrics(current);

    if (
      result.price === current.price &&
      result.cost === current.cost &&
      result.profit === current.profit &&
      !productionMetrics?.changed
    ) {
      return false;
    }

    const oldPrice = current.price;
    const updated: Product = {
      ...current,
      price: result.price,
      cost: result.cost,
      profit: result.profit,
      updatedAt: new Date().toISOString(),
      ...(productionMetrics?.values ?? {}),
    };

    this.products.save(updated);

    if (oldPrice !== result.price) {
      priceChanges.set(current.id, {
        oldPrice,
        newPrice: result.price,
      });
    }

    return true;
  }

  private resolveCompositeProductionMetrics(
    product: Product,
  ): { changed: boolean; values: Pick<Product3D, 'grams' | 'printTimeHours' | 'workTimeHours'> } | null {
    if (!this.hasComponents(product)) {
      return null;
    }

    if (
      product.type !== ProductType.FDM &&
      product.type !== ProductType.RESINA
    ) {
      return null;
    }

    const current = product as Product3D;
    const metrics = sumComponentsProductionMetrics(
      this.store,
      product.components ?? [],
      { assemblyTimeHours: product.assemblyTimeHours },
    );

    return {
      changed:
        current.grams !== metrics.grams ||
        current.printTimeHours !== metrics.printTimeHours ||
        current.workTimeHours !== metrics.workTimeHours,
      values: {
        grams: metrics.grams,
        printTimeHours: metrics.printTimeHours,
        workTimeHours: metrics.workTimeHours,
      },
    };
  }

  private syncOrderPrices(
    priceChanges: Map<string, ProductPriceChange>,
    trigger: OrderPriceChangeTrigger,
  ): void {
    if (!priceChanges.size) return;

    let ordersUpdated = 0;

    for (const order of this.orders.findAll()) {
      if (!ADJUSTABLE_ORDER_STATUSES.has(order.status)) continue;

      const previousTotal = order.total;
      const lineChanges: Array<{
        index: number;
        item: Order['items'][number];
        previousUnitPrice: number;
        newUnitPrice: number;
      }> = [];

      for (let index = 0; index < order.items.length; index++) {
        const item = order.items[index];
        if (!item.productId) continue;

        const change = priceChanges.get(item.productId);
        if (!change || change.newPrice === item.unitPrice) continue;

        lineChanges.push({
          index,
          item,
          previousUnitPrice: item.unitPrice,
          newUnitPrice: change.newPrice,
        });
        item.unitPrice = change.newPrice;
      }

      if (!lineChanges.length) continue;

      order.total = calculateTotalWithDiscount(
        calculateItemsSubtotal(order.items),
        normalizeDiscountFields({
          discountPercent: order.discountPercent,
          discountAmount: order.discountAmount,
        }),
      );

      for (const line of lineChanges) {
        appendOrderPriceHistory(order, {
          trigger,
          itemIndex: line.index,
          productId: line.item.productId!,
          productName: line.item.productName,
          previousUnitPrice: line.previousUnitPrice,
          newUnitPrice: line.newUnitPrice,
          previousOrderTotal: previousTotal,
          newOrderTotal: order.total,
        });
      }

      this.orders.save(order);
      ordersUpdated++;
    }

    if (ordersUpdated > 0) {
      this.logger.log(
        `Precios actualizados en ${ordersUpdated} pedido(s) (${trigger})`,
      );
    }
  }

  private notifyChanges(hasChanges: boolean): void {
    if (!hasChanges) return;

    this.storeChange.recordChange({
      collections: ['products', 'orders'],
      realtime: {
        scopes: ['products', 'orders', 'dashboard', 'sales'],
        action: 'update',
        entity: 'product',
      },
    });
  }
}
