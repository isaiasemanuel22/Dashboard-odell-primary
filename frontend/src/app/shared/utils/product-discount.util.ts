import { DISCOUNT_PERCENT_MAX } from './discount.util';

/**
 * Descuento propio de un producto del catálogo (§16.1.2).
 * Misma fórmula que `backend/src/common/utils/product-discount.util.ts`.
 */
export interface ProductDiscountPricedProduct {
  /** Precio de LISTA (antes del descuento del producto). */
  price: number;
  discountPercent?: number | null;
  discountAmount?: number | null;
}

function positive(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Descuento en pesos sobre la lista (redondeado al peso). */
export function productDiscountValue(
  product: ProductDiscountPricedProduct,
): number {
  const list = Math.round(Number(product.price) || 0);
  if (list <= 0) return 0;
  const amount = positive(product.discountAmount);
  if (amount > 0) {
    return Math.min(Math.round(amount), Math.max(0, list - 1));
  }
  const percent = Math.min(positive(product.discountPercent), DISCOUNT_PERCENT_MAX);
  if (percent > 0) return Math.round(list * (percent / 100));
  return 0;
}

export function hasProductDiscount(
  product: Pick<ProductDiscountPricedProduct, 'discountPercent' | 'discountAmount'>,
): boolean {
  return (
    positive(product.discountPercent) > 0 || positive(product.discountAmount) > 0
  );
}

/** Precio de venta = lista − descuento propio. Base de toda línea de catálogo. */
export function productSalePrice(product: ProductDiscountPricedProduct): number {
  const discount = productDiscountValue(product);
  if (discount <= 0) return product.price;
  return Math.round(Number(product.price) || 0) - discount;
}

/** Etiqueta corta: «−15 %» o «−$1.000». Vacía si no hay descuento. */
export function productDiscountLabel(
  product: Pick<ProductDiscountPricedProduct, 'discountPercent' | 'discountAmount'>,
  formatMoney: (value: number) => string = defaultMoney,
): string {
  const amount = positive(product.discountAmount);
  if (amount > 0) return `−${formatMoney(Math.round(amount))}`;
  const percent = positive(product.discountPercent);
  if (percent > 0) {
    return `−${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(percent)} %`;
  }
  return '';
}

function defaultMoney(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}
