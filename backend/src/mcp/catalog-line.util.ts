import { NotFoundException } from '@nestjs/common';
import { Product } from '../common/interfaces';
import { serviceTypeFromProduct } from '../common/service-type.util';
import { productSalePrice } from '../common/utils/product-discount.util';
import { StoreService } from '../store/store.service';

/** Producto publicado del catálogo; si no está, 404. */
export function findPublishedProduct(
  store: StoreService,
  productId: string,
): Product {
  const product = store.products.find(
    (item) => item.id === productId && item.published !== false,
  );
  if (!product) {
    throw new NotFoundException(`Producto ${productId} no encontrado`);
  }
  return product;
}

/** Línea de presupuesto con el precio de catálogo del producto. */
export function catalogLine(product: Product, quantity: number) {
  return {
    serviceType: serviceTypeFromProduct(product),
    productId: product.id,
    productName: product.name,
    quantity,
    unitPrice: productSalePrice(product),
  };
}
