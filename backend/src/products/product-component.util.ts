import { ProductComponent } from '../common/interfaces';

export interface ProductComponentCatalogEntry {
  id: string;
  name: string;
}

/** Normaliza piezas incluidas desde JSON legacy o formatos inconsistentes. */
export function normalizeProductComponents(
  raw: unknown,
  catalog?: ProductComponentCatalogEntry[],
): ProductComponent[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeOneProductComponent(item, catalog))
      .filter((item): item is ProductComponent => item !== null);
  }

  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) =>
        normalizeOneProductComponent(
          typeof value === 'object' && value !== null
            ? value
            : { productId: key, quantity: value },
          catalog,
        ),
      )
      .filter((item): item is ProductComponent => item !== null);
  }

  return [];
}

/** Segunda pasada cuando ya están todos los productos cargados en memoria. */
export function resolveAllProductComponents<T extends { components: unknown }>(
  products: T[],
  catalog?: ProductComponentCatalogEntry[],
): T[] {
  const entries =
    catalog ??
    products.map((product) => ({
      id: (product as { id?: string }).id ?? '',
      name: (product as { name?: string }).name ?? '',
    }));

  return products.map((product) => ({
    ...product,
    components: normalizeProductComponents(product.components, entries),
  }));
}

function normalizeOneProductComponent(
  item: unknown,
  catalog?: ProductComponentCatalogEntry[],
): ProductComponent | null {
  if (typeof item === 'string') {
    const productId = item.trim();
    return productId ? { productId, quantity: 1 } : null;
  }

  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const productId = resolveProductId(record, catalog);
  if (!productId) return null;

  const quantityRaw =
    record.quantity ?? record.qty ?? record.count ?? record.amount ?? 1;
  const quantity = Math.max(1, Math.floor(Number(quantityRaw) || 1));

  return { productId, quantity };
}

function resolveProductId(
  record: Record<string, unknown>,
  catalog?: ProductComponentCatalogEntry[],
): string | null {
  const direct = pickString(record, [
    'productId',
    'product_id',
    'productID',
    'pieceId',
    'piece_id',
    'product',
    'ref',
  ]);
  if (direct) return direct;

  const nestedProduct = record.product;
  if (nestedProduct && typeof nestedProduct === 'object') {
    const nestedRecord = nestedProduct as Record<string, unknown>;
    const nestedId = pickString(nestedRecord, [
      'productId',
      'product_id',
      'id',
    ]);
    if (nestedId) return nestedId;

    const nestedName = pickString(nestedRecord, ['name']);
    const byNestedName = resolveProductIdByName(nestedName, catalog);
    if (byNestedName) return byNestedName;
  }

  const byName = resolveProductIdByName(
    pickString(record, ['name', 'productName', 'pieceName', 'piece']),
    catalog,
  );
  if (byName) return byName;

  const fallbackId = pickString(record, ['id']);
  if (!fallbackId) return null;
  if (catalog?.some((entry) => entry.id === fallbackId)) return fallbackId;
  if (/^prod-/i.test(fallbackId)) return fallbackId;

  return null;
}

function resolveProductIdByName(
  name: string | null,
  catalog?: ProductComponentCatalogEntry[],
): string | null {
  if (!name || !catalog?.length) return null;
  const normalized = name.trim().toLowerCase();
  return (
    catalog.find((entry) => entry.name.trim().toLowerCase() === normalized)
      ?.id ?? null
  );
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
