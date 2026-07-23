import {
  Category,
  Product,
  ProductComponent,
  ServiceProfitMargins,
  ServiceType,
} from '../../core/models';
import {
  costFromPriceAndMargin,
  normalizeProfitMargins,
} from './pricing.util';

export function normalizeProductComponents(
  raw: ProductComponent[] | unknown,
): ProductComponent[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeOneProductComponent(item))
      .filter((item): item is ProductComponent => item !== null);
  }

  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) =>
        normalizeOneProductComponent(
          typeof value === 'object' && value !== null
            ? value
            : { productId: key, quantity: value },
        ),
      )
      .filter((item): item is ProductComponent => item !== null);
  }

  return [];
}

function normalizeOneProductComponent(item: unknown): ProductComponent | null {
  if (typeof item === 'string') {
    const productId = item.trim();
    return productId ? { productId, quantity: 1 } : null;
  }

  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const productId = pickString(record, [
    'productId',
    'product_id',
    'productID',
    'id',
  ]);
  if (!productId) return null;

  const quantityRaw =
    record['quantity'] ?? record['qty'] ?? record['count'] ?? record['amount'] ?? 1;
  const quantity = Math.max(1, Math.floor(Number(quantityRaw) || 1));

  return { productId, quantity };
}

function pickString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function findProductById(
  catalog: Product[],
  id: string,
): Product | undefined {
  return catalog.find((p) => p.id === id);
}

export function getProductName(
  catalog: Product[],
  id: string,
  fallback = 'Producto',
): string {
  return findProductById(catalog, id)?.name ?? fallback;
}

export function getComponentLineCost(
  catalog: Product[],
  productId: string,
  quantity: number,
): number {
  const part = findProductById(catalog, productId);
  const qty = Math.max(1, Number(quantity) || 1);
  return (part?.cost ?? 0) * qty;
}

export function getComponentLinePrice(
  catalog: Product[],
  productId: string,
  quantity: number,
): number {
  const part = findProductById(catalog, productId);
  const qty = Math.max(1, Number(quantity) || 1);
  return (part?.price ?? 0) * qty;
}

export function sumComponentsCost(
  catalog: Product[],
  components: ProductComponent[],
): number {
  return components.reduce(
    (sum, item) => sum + getComponentLineCost(catalog, item.productId, item.quantity),
    0,
  );
}

export function calculateCatalogLinesCost(
  lines: Array<{ productId?: string; quantity: number }>,
  catalog: Product[],
): number {
  return lines.reduce((sum, line) => {
    if (!line.productId) return sum;
    return sum + getComponentLineCost(catalog, line.productId, line.quantity);
  }, 0);
}

export function calculateOrderLinesCost(
  lines: Array<{
    serviceType?: ServiceType;
    productId?: string;
    quantity: number;
    unitCost?: number;
    unitPrice?: number;
  }>,
  catalog: Product[],
  profitMargins: ServiceProfitMargins,
): number {
  const margins = normalizeProfitMargins(profitMargins);

  return lines.reduce((sum, line) => {
    if (line.productId) {
      return sum + getComponentLineCost(catalog, line.productId, line.quantity);
    }

    if (line.serviceType === ServiceType.DISENO) {
      const unitCost =
        line.unitCost != null && line.unitCost >= 0
          ? line.unitCost
          : costFromPriceAndMargin(line.unitPrice ?? 0, margins.diseno);
      return sum + unitCost * line.quantity;
    }

    return sum;
  }, 0);
}

export function sumComponentsPrice(
  catalog: Product[],
  components: ProductComponent[],
): number {
  return components.reduce(
    (sum, item) => sum + getComponentLinePrice(catalog, item.productId, item.quantity),
    0,
  );
}

export function resolveCategoryNames(
  categoryIds: string[],
  categories: Category[],
): string[] {
  return categoryIds
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

export function resolveCategoryNamesText(
  categoryIds: string[],
  categories: Category[],
): string {
  return resolveCategoryNames(categoryIds, categories).join(', ');
}

export function productComponentSelectLabel(product: Product): string {
  return product.published === false ? `${product.name} (interno)` : product.name;
}

export function isProductPublished(product: Product): boolean {
  return product.published !== false;
}
