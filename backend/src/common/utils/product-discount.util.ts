import { BadRequestException } from '@nestjs/common';
import { DISCOUNT_PERCENT_MAX } from './discount.util';

/** Descuento propio de un producto del catálogo (§16.1.2). Uno solo de los dos. */
export interface ProductDiscountFields {
  discountPercent?: number | null;
  discountAmount?: number | null;
}

export interface ProductDiscountPricedProduct extends ProductDiscountFields {
  /** Precio de LISTA (antes del descuento del producto). */
  price: number;
}

function positive(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Descuento en pesos sobre el precio de lista (redondeado al peso). */
export function productDiscountValue(
  product: ProductDiscountPricedProduct,
): number {
  const list = Math.round(Number(product.price) || 0);
  if (list <= 0) return 0;
  const amount = positive(product.discountAmount);
  if (amount > 0) {
    // Como mucho un peso menos que la lista.
    return Math.min(Math.round(amount), Math.max(0, list - 1));
  }
  const percent = Math.min(
    positive(product.discountPercent),
    DISCOUNT_PERCENT_MAX,
  );
  if (percent > 0) return Math.round(list * (percent / 100));
  return 0;
}

export function hasProductDiscount(product: ProductDiscountFields): boolean {
  return (
    positive(product.discountPercent) > 0 ||
    positive(product.discountAmount) > 0
  );
}

/**
 * Precio de venta del producto = lista − descuento propio. Es el precio base
 * de toda línea de catálogo (pedido, presupuesto, venta de mostrador).
 */
export function productSalePrice(
  product: ProductDiscountPricedProduct,
): number {
  const discount = productDiscountValue(product);
  if (discount <= 0) return product.price;
  return Math.round(Number(product.price) || 0) - discount;
}

/**
 * Normaliza y valida el descuento de un producto: o porcentaje (0–99) o monto
 * fijo (menor que la lista), nunca los dos. `null` = sin descuento.
 */
export function normalizeProductDiscount(
  input: ProductDiscountFields,
  listPrice?: number,
): { discountPercent: number | null; discountAmount: number | null } {
  const percent = positive(input.discountPercent);
  const amount = positive(input.discountAmount);
  if (percent > 0 && amount > 0) {
    throw new BadRequestException(
      'Usá un solo tipo de descuento: porcentaje o monto fijo',
    );
  }
  if (percent > DISCOUNT_PERCENT_MAX) {
    throw new BadRequestException(
      `El descuento no puede superar el ${DISCOUNT_PERCENT_MAX} %`,
    );
  }
  if (amount > 0 && listPrice != null && listPrice > 0) {
    if (Math.round(amount) >= Math.round(listPrice)) {
      throw new BadRequestException(
        'El descuento en pesos debe ser menor que el precio de lista',
      );
    }
  }
  return {
    discountPercent: percent > 0 ? percent : null,
    discountAmount: amount > 0 ? Math.round(amount) : null,
  };
}
