import { OrderStatus } from '../common/enums';
import { ProductStockOverview } from '../common/interfaces';
import { StoreService } from '../store/store.service';
import {
  normalizeProductComponents,
  productUsesPieceAssembly,
} from './product-component.util';

export function getTotalReservedForProduct(
  store: StoreService,
  productId: string,
  excludeOrderId?: string,
): number {
  return store.orders.reduce((sum, order) => {
    if (order.id === excludeOrderId) {
      return sum;
    }

    if (
      order.status === OrderStatus.CANCELADO ||
      order.status === OrderStatus.ENTREGADO
    ) {
      return sum;
    }

    return (
      sum +
      order.items
        .filter((line) => line.productId === productId)
        .reduce((subtotal, line) => subtotal + (line.reservedQuantity ?? 0), 0)
    );
  }, 0);
}

/** Cuántas unidades completas se pueden armar con el stock disponible de las piezas. */
export function computeAssemblableUnits(
  store: StoreService,
  productId: string,
  visiting: Set<string> = new Set(),
): number {
  if (visiting.has(productId)) {
    return 0;
  }

  const product = store.getProductById(productId);
  if (!product) {
    return 0;
  }

  const catalog = store.products.map((entry) => ({
    id: entry.id,
    name: entry.name,
  }));
  const components = normalizeProductComponents(product.components ?? [], catalog);

  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return 0;
  }

  visiting.add(productId);
  let limit = Number.POSITIVE_INFINITY;

  for (const component of components) {
    const partOverview = buildProductStockOverview(store, component.productId);
    const required = Math.max(1, Math.trunc(Number(component.quantity) || 1));
    const possible = Math.floor(partOverview.available / required);
    limit = Math.min(limit, possible);
  }

  visiting.delete(productId);
  return Number.isFinite(limit) ? Math.max(0, limit) : 0;
}

export function resolveProductPhysicalStock(
  store: StoreService,
  productId: string,
): number {
  const product = store.getProductById(productId);
  const finished = Math.max(0, Math.trunc(product?.stock ?? 0));

  if (!product) {
    return 0;
  }

  const catalog = store.products.map((entry) => ({
    id: entry.id,
    name: entry.name,
  }));
  const components = normalizeProductComponents(product.components ?? [], catalog);

  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return finished;
  }

  const assemblable = computeAssemblableUnits(store, productId);
  if (assemblable <= 0) {
    return 0;
  }

  return finished + assemblable;
}

export function buildProductStockOverview(
  store: StoreService,
  productId: string,
  options?: { excludeOrderId?: string },
): ProductStockOverview {
  const physical = resolveProductPhysicalStock(store, productId);
  const reserved = getTotalReservedForProduct(
    store,
    productId,
    options?.excludeOrderId,
  );
  const available = Math.max(physical - reserved, 0);

  return { physical, reserved, available };
}
