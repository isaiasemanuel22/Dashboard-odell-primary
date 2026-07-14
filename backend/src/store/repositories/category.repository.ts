import { Injectable } from '@nestjs/common';
import { ProductType } from '../../common/enums';
import { Category } from '../../common/interfaces';
import { StoreService } from '../store.service';

@Injectable()
export class CategoryRepository {
  constructor(private readonly store: StoreService) {}

  findAll(type?: ProductType): Category[] {
    if (!type) return this.store.categories;
    return this.store.categories.filter((c) => c.productTypes.includes(type));
  }

  findById(id: string): Category | undefined {
    return this.store.getCategoryById(id);
  }

  nameExists(name: string, excludeId?: string): boolean {
    const normalized = name.toLowerCase();
    return this.store.categories.some(
      (c) => c.name.toLowerCase() === normalized && c.id !== excludeId,
    );
  }

  create(data: { name: string; productTypes: ProductType[] }): Category {
    const category: Category = {
      id: this.store.nextId('cat', this.store.categories),
      name: data.name,
      productTypes: data.productTypes,
      createdAt: new Date().toISOString(),
    };
    this.store.categories.push(category);
    this.store.indexCategory(category);
    return category;
  }

  remove(id: string): boolean {
    return this.store.removeCategory(id);
  }

  isUsedByProducts(categoryId: string): boolean {
    return this.store.products.some((p) => p.categoryIds.includes(categoryId));
  }
}
