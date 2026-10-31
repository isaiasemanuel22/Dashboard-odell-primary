import { OrderLineDraft, Product } from '../core/models';

export function isOrderQuoteCatalogLocked(line: OrderLineDraft): boolean {
  return !!line.productId?.trim();
}

export function formatOrderQuoteNumber(value: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

export function formatOrderQuoteMoney(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function resolveOrderQuoteWashMinutes(
  line: OrderLineDraft,
  product: Product | null | undefined,
): number {
  if (line.washMinutes != null && Number.isFinite(Number(line.washMinutes))) {
    return Math.max(0, Number(line.washMinutes) || 0);
  }
  if (product && 'washMinutes' in product) {
    return Math.max(0, Number(product.washMinutes) || 0);
  }
  return 0;
}

export function resolveOrderQuoteCureMinutes(
  line: OrderLineDraft,
  product: Product | null | undefined,
): number {
  if (line.cureMinutes != null && Number.isFinite(Number(line.cureMinutes))) {
    return Math.max(0, Number(line.cureMinutes) || 0);
  }
  if (product && 'cureMinutes' in product) {
    return Math.max(0, Number(product.cureMinutes) || 0);
  }
  return 0;
}
