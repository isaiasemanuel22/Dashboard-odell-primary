import { Injectable } from '@nestjs/common';
import { Product } from '../../common/interfaces';
import { StoreService } from '../store.service';

@Injectable()
export class ProductRepository {
  constructor(private readonly store: StoreService) {}

  findAll(): Product[] {
    return this.store.products;
  }

  findById(id: string): Product | undefined {
    return this.store.getProductById(id);
  }

  create(product: Product): Product {
    this.store.products.push(product);
    this.store.indexProduct(product);
    return product;
  }

  save(product: Product): Product {
    this.store.replaceProduct(product);
    return product;
  }

  remove(id: string): boolean {
    return this.store.removeProduct(id);
  }

  findUsedAsComponent(productId: string): Product[] {
    return this.store.products.filter((product) =>
      (product.components ?? []).some(
        (component) => component.productId === productId,
      ),
    );
  }
}
