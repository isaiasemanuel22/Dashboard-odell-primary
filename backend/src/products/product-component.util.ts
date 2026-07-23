import { ProductComponent } from '../common/interfaces';

/** Normaliza piezas incluidas desde JSON legacy o formatos inconsistentes. */
export function normalizeProductComponents(raw: unknown): ProductComponent[] {
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
    record.quantity ?? record.qty ?? record.count ?? record.amount ?? 1;
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
