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
  return (part?.cost ?? 0) * quantity;
}

export function getComponentLinePrice(
  catalog: Product[],
  productId: string,
  quantity: number,
): number {
  const part = findProductById(catalog, productId);
  return (part?.price ?? 0) * quantity;
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
