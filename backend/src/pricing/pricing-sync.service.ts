import { Injectable, Logger } from '@nestjs/common';
import {
  OrderStatus,
  PriceType,
  ProductType,
  QuoteStatus,
} from '../common/enums';
import { Product, Product3D, Quote } from '../common/interfaces';
import {
  calculateTotalWithDiscount,
  normalizeDiscountFields,
} from '../common/utils/discount.util';
import { appendOrderPriceHistory } from '../orders/order-price-history.util';
import {
  hasRecordedPricePair,
  orderLineListPrice,
} from '../orders/order-price-notice.util';
import type { OrderPriceChangeTrigger } from '../orders/order-price-history.util';
import { calculateOrderItemsSubtotal } from '../orders/order-pricing.util';
import { applyWholesalePricing } from '../orders/wholesale-pricing.util';
import { ProductPricingService } from '../products/product-pricing.service';
import { sumComponentsProductionMetrics } from '../products/product-production.util';
import { normalizeWholesaleDiscount } from '../settings/wholesale-discount.util';
import {
  OrderRepository,
  ProductRepository,
  QuoteRepository,
} from '../store/repositories';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';

export interface ProductPriceChange {
  oldPrice: number;
  newPrice: number;
}

const CLOSED_QUOTE_STATUSES = new Set<QuoteStatus>([
  QuoteStatus.ACEPTADO,
  QuoteStatus.RECHAZADO,
  QuoteStatus.CANCELADO,
]);

@Injectable()
export class PricingSyncService {
  private readonly logger = new Logger(PricingSyncService.name);

  constructor(
    private readonly store: StoreService,
    private readonly products: ProductRepository,
    private readonly orders: OrderRepository,
    private readonly quotes: QuoteRepository,
    private readonly pricing: ProductPricingService,
    private readonly storeChange: StoreChangeService,
  ) {}

  /**
   * `updatePrices: false` (por defecto): solo refresca costo/ganancia/métricas
   * guardadas; el precio de venta NO cambia solo. `true` es el recálculo
   * explícito pedido por el usuario («Recalcular precios»).
   */
  syncAllProductsAndOrders(
    trigger: OrderPriceChangeTrigger,
    options: { updatePrices?: boolean } = {},
  ): void {
    const updatePrices = options.updatePrices === true;
    const { priceChanges, recalculated } =
      this.recalculateAllProducts(updatePrices);
    const quotesChanged = this.syncQuotePrices(priceChanges);
    this.syncOrderPrices(priceChanges, trigger);
    this.notifyChanges(recalculated || priceChanges.size > 0, quotesChanged);
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

    // Guardar un producto no reescribe el precio de otros (combos que lo usan):
    // su costo se lee vigente al consultarlos y el precio queda como estaba.
    const quotesChanged = this.syncQuotePrices(priceChanges);
    this.syncOrderPrices(priceChanges, 'product_update');
    this.notifyChanges(priceChanges.size > 0, quotesChanged);
  }

  /** Registra avisos en pedidos (y sync de presupuestos) tras un cambio de catálogo ya guardado. */
  syncCatalogPriceChanges(
    priceChanges: Map<string, ProductPriceChange>,
    trigger: OrderPriceChangeTrigger,
  ): void {
    if (!priceChanges.size) return;
    const quotesChanged = this.syncQuotePrices(priceChanges);
    this.syncOrderPrices(priceChanges, trigger);
    this.notifyChanges(true, quotesChanged);
  }

  private recalculateAllProducts(updatePrices: boolean): {
    priceChanges: Map<string, ProductPriceChange>;
    recalculated: boolean;
  } {
    const priceChanges = new Map<string, ProductPriceChange>();
    let recalculated = false;

    for (const product of [...this.store.products]) {
      if (this.hasComponents(product)) continue;
      if (this.applyProductRecalc(product, priceChanges, updatePrices)) {
        recalculated = true;
      }
    }

    if (this.recalculateCompositeProducts(priceChanges, updatePrices)) {
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
    updatePrices: boolean,
  ): boolean {
    let recalculated = false;
    for (let pass = 0; pass < 12; pass++) {
      let changed = false;
      for (const product of [...this.store.products]) {
        if (!this.hasComponents(product)) continue;
        if (this.applyProductRecalc(product, priceChanges, updatePrices)) {
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
    updatePrices: boolean,
  ): boolean {
    const current = this.store.getProductById(product.id);
    if (!current) return false;

    const computed = this.pricing.resolvePricing(
      this.pricing.productToPricingInput(current),
    );
    const result = updatePrices
      ? computed
      : {
          ...computed,
          price: current.price,
          profit: current.price - computed.cost,
        };
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
      suggestedPrice:
        current.suggestedPrice != null && Number(current.suggestedPrice) > 0
          ? Number(current.suggestedPrice)
          : null,
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

  private resolveCompositeProductionMetrics(product: Product): {
    changed: boolean;
    values: Pick<Product3D, 'grams' | 'printTimeHours' | 'workTimeHours'>;
  } | null {
    if (!this.hasComponents(product)) {
      return null;
    }

    if (
      product.type !== ProductType.FDM &&
      product.type !== ProductType.RESINA
    ) {
      return null;
    }

    const current = product;
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

  private syncQuotePrices(
    priceChanges: Map<string, ProductPriceChange>,
  ): boolean {
    if (!priceChanges.size) return false;

    let quotesUpdated = 0;
    for (const quote of this.quotes.findAll()) {
      // §5: borrador y enviado siguen al catálogo; cerrado no (§16.2).
      if (CLOSED_QUOTE_STATUSES.has(quote.status)) continue;
      if (!this.applyQuotePriceChanges(quote, priceChanges)) continue;
      this.quotes.save(quote);
      quotesUpdated += 1;
    }

    if (quotesUpdated > 0) {
      this.logger.log(
        `Precios actualizados en ${quotesUpdated} presupuesto(s)`,
      );
    }
    return quotesUpdated > 0;
  }

  private applyQuotePriceChanges(
    quote: Quote,
    priceChanges: Map<string, ProductPriceChange>,
  ): boolean {
    let changed = false;
    for (const item of quote.items) {
      if (!item.productId) continue;
      if (item.unitPriceManual) continue;
      const change = priceChanges.get(item.productId);
      const listPrice = item.listUnitPrice ?? item.unitPrice;
      if (!change || change.newPrice === listPrice) continue;
      // Precio de catálogo = lista; el mayorista se reaplica después.
      item.unitPrice = change.newPrice;
      delete item.listUnitPrice;
      changed = true;
    }
    if (!changed) return false;

    const customer = quote.customerId
      ? this.store.getCustomerById(quote.customerId)
      : null;
    const priced = applyWholesalePricing(quote.items, {
      priceType: quote.priceType ?? PriceType.LISTA,
      customer: customer ?? null,
      settings: normalizeWholesaleDiscount(
        this.store.generalSettings.wholesaleDiscount,
      ),
    });
    quote.items = priced.items;
    quote.wholesaleApplied = priced.wholesaleApplied;

    quote.total = calculateTotalWithDiscount(
      calculateOrderItemsSubtotal(quote.items),
      normalizeDiscountFields({
        discountPercent: quote.discountPercent,
        discountAmount: quote.discountAmount,
      }),
    );
    return true;
  }

  private syncOrderPrices(
    priceChanges: Map<string, ProductPriceChange>,
    trigger: OrderPriceChangeTrigger,
  ): void {
    if (!priceChanges.size) return;

    let ordersUpdated = 0;

    for (const order of this.orders.findAll()) {
      if (order.status === OrderStatus.CANCELADO) continue;

      let recorded = false;
      for (let index = 0; index < order.items.length; index++) {
        const item = order.items[index];
        if (!item.productId) continue;

        const change = priceChanges.get(item.productId);
        // El catálogo es de lista: comparar contra la lista de la línea, no
        // contra lo que se cobra (en mayoristas son distintos).
        const listPrice = orderLineListPrice(item);
        if (!change || change.newPrice === listPrice) continue;
        if (hasRecordedPricePair(order, index, listPrice, change.newPrice)) {
          continue;
        }

        appendOrderPriceHistory(order, {
          trigger,
          itemIndex: index,
          productId: item.productId,
          productName: item.productName,
          previousUnitPrice: listPrice,
          newUnitPrice: change.newPrice,
          previousOrderTotal: order.total,
          newOrderTotal: order.total,
        });
        recorded = true;
      }

      if (!recorded) continue;
      this.orders.save(order);
      ordersUpdated++;
    }

    if (ordersUpdated > 0) {
      this.logger.log(
        `Diferencia de precio registrada en ${ordersUpdated} pedido(s) (${trigger})`,
      );
    }
  }

  private notifyChanges(hasChanges: boolean, quotesChanged = false): void {
    if (!hasChanges && !quotesChanged) return;

    this.storeChange.recordChange({
      collections: quotesChanged
        ? ['products', 'orders', 'quotes']
        : ['products', 'orders'],
      realtime: {
        scopes: quotesChanged
          ? ['products', 'orders', 'quotes', 'dashboard', 'sales']
          : ['products', 'orders', 'dashboard', 'sales'],
        action: 'update',
        entity: 'product',
      },
    });
  }
}
