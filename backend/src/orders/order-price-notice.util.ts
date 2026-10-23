import { OrderStatus } from '../common/enums';
import {
  Order,
  OrderPriceHistoryEntry,
  OrderPriceNotice,
} from '../common/interfaces';
import { appendOrderPriceHistory } from './order-price-history.util';

export type { OrderPriceNotice };

export function listOrderPriceNotices(
  order: Order,
  currentPrice: (productId: string) => number | undefined,
): OrderPriceNotice[] {
  if (order.status === OrderStatus.CANCELADO) return [];

  const notices: OrderPriceNotice[] = [];
  order.items.forEach((item, itemIndex) => {
    if (!item.productId) return;
    const current = currentPrice(item.productId);
    if (current === undefined || current === item.unitPrice) return;
    if (isLinePriceKept(order, itemIndex, item.unitPrice, current)) return;
    notices.push({
      itemIndex,
      productId: item.productId,
      productName: item.productName,
      agreedUnitPrice: item.unitPrice,
      currentUnitPrice: current,
    });
  });
  return notices;
}

export function hasRecordedPricePair(
  order: Order,
  itemIndex: number,
  previousUnitPrice: number,
  newUnitPrice: number,
): boolean {
  return (order.priceHistory ?? []).some(
    (entry) =>
      entry.itemIndex === itemIndex &&
      entry.previousUnitPrice === previousUnitPrice &&
      entry.newUnitPrice === newUnitPrice,
  );
}

export function rememberKeptLinePrice(
  order: Order,
  itemIndex: number,
  agreedUnitPrice: number,
  currentUnitPrice: number,
  productId: string,
  productName: string,
): boolean {
  const history = order.priceHistory ?? [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]!;
    if (entry.itemIndex !== itemIndex) continue;
    if (
      entry.previousUnitPrice !== agreedUnitPrice ||
      entry.newUnitPrice !== currentUnitPrice
    ) {
      continue;
    }
    if (entry.kept) return false;
    entry.kept = true;
    return true;
  }

  appendOrderPriceHistory(order, {
    trigger: 'product_update',
    itemIndex,
    productId,
    productName,
    previousUnitPrice: agreedUnitPrice,
    newUnitPrice: currentUnitPrice,
    previousOrderTotal: order.total,
    newOrderTotal: order.total,
    kept: true,
  });
  return true;
}

function isLinePriceKept(
  order: Order,
  itemIndex: number,
  agreedUnitPrice: number,
  currentUnitPrice: number,
): boolean {
  const history = order.priceHistory ?? [];
  let match: OrderPriceHistoryEntry | undefined;
  for (const entry of history) {
    if (entry.itemIndex !== itemIndex) continue;
    if (
      entry.previousUnitPrice === agreedUnitPrice &&
      entry.newUnitPrice === currentUnitPrice
    ) {
      match = entry;
    }
  }
  return match?.kept === true;
}
