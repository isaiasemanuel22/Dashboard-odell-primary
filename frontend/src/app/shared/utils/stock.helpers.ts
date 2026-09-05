import { Product, ProductStockOverview } from '../../core/models';
import {
  findProductById,
  normalizeProductComponents,
  productUsesPieceAssembly,
} from './product.helpers';

export function productPhysicalStock(
  product: Pick<Product, 'stock' | 'finishedStock'>,
): number {
  return Math.max(0, Math.trunc(Number(product.stock ?? product.finishedStock) || 0));
}

/** Cuántas unidades completas se pueden armar con el stock disponible de las piezas. */
export function computeAssemblableUnits(
  product: Pick<
    Product,
    'id' | 'type' | 'includesPieces' | 'components' | 'stock' | 'finishedStock'
  >,
  catalog: Product[],
  visiting: Set<string> = new Set(),
): number {
  if (visiting.has(product.id)) {
    return 0;
  }

  const components = normalizeProductComponents(product.components ?? [], catalog);
  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return 0;
  }

  visiting.add(product.id);
  let limit = Number.POSITIVE_INFINITY;

  for (const component of components) {
    const part = findProductById(catalog, component.productId);
    if (!part) {
      limit = 0;
      break;
    }

    const partOverview = productStockOverview(part, undefined, catalog, visiting);
    const required = Math.max(1, Math.trunc(Number(component.quantity) || 1));
    const possible = Math.floor(partOverview.available / required);
    limit = Math.min(limit, possible);
  }

  visiting.delete(product.id);
  return Number.isFinite(limit) ? Math.max(0, limit) : 0;
}

export function resolveProductPhysicalStock(
  product: Pick<
    Product,
    'id' | 'type' | 'includesPieces' | 'components' | 'stock' | 'finishedStock'
  >,
  catalog?: Product[],
  visiting: Set<string> = new Set(),
): number {
  const finished = productPhysicalStock(product);

  if (!catalog?.length) {
    return finished;
  }

  const components = normalizeProductComponents(product.components ?? [], catalog);
  if (!productUsesPieceAssembly(product) || components.length === 0) {
    return finished;
  }

  const assemblable = computeAssemblableUnits(product, catalog, visiting);
  if (assemblable <= 0) {
    return 0;
  }

  return finished + assemblable;
}

export function productStockOverview(
  product: Pick<Product, 'stock' | 'finishedStock'> &
    Partial<Pick<Product, 'id' | 'type' | 'includesPieces' | 'components'>>,
  overview?: ProductStockOverview | null,
  catalog?: Product[],
  visiting?: Set<string>,
): ProductStockOverview {
  if (overview) {
    const physical = overview.physical;
    const reserved = Math.max(0, Math.trunc(Number(overview.reserved) || 0));
    const available = overview.available ?? Math.max(physical - reserved, 0);
    return { physical, reserved, available };
  }

  const hasAssemblyContext =
    Boolean(product.id) &&
    Boolean(catalog?.length) &&
    productUsesPieceAssembly(product as Pick<Product, 'type' | 'includesPieces' | 'components'>);

  const physical = hasAssemblyContext
    ? resolveProductPhysicalStock(
        product as Pick<
          Product,
          'id' | 'type' | 'includesPieces' | 'components' | 'stock' | 'finishedStock'
        >,
        catalog,
        visiting,
      )
    : productPhysicalStock(product);
  const reserved = 0;
  const available = Math.max(physical - reserved, 0);

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
