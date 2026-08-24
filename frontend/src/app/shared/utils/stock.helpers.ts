import { Product, ProductStockOverview } from '../../core/models';

export function productPhysicalStock(
  product: Pick<Product, 'stock' | 'finishedStock'>,
): number {
  return Math.max(0, Math.trunc(Number(product.stock ?? product.finishedStock) || 0));
}

export function productStockOverview(
  product: Pick<Product, 'stock' | 'finishedStock'>,
  overview?: ProductStockOverview | null,
): ProductStockOverview {
  const physical = overview?.physical ?? productPhysicalStock(product);
  const reserved = Math.max(0, Math.trunc(Number(overview?.reserved) || 0));
  const available = overview?.available ?? Math.max(physical - reserved, 0);

  return { physical, reserved, available };
}

export function canCloseRetailSale(
  lines: Array<{ productId: string; quantity: number }>,
  availableStock: (productId: string) => number,
): boolean {
  return (
    lines.length > 0 &&
    lines.every(
      (line) =>
        line.quantity > 0 && line.quantity <= availableStock(line.productId),
    )
  );
}
