import { Injectable } from '@nestjs/common';
import { SupplyCategory } from '../../common/enums';
import { Supply } from '../../common/interfaces';
import { StoreService } from '../store.service';

@Injectable()
export class SupplyRepository {
  constructor(private readonly store: StoreService) {}

  findAll(category?: SupplyCategory): Supply[] {
    const items = [...this.store.supplies].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (!category) return items;
    return items.filter((s) => s.category === category);
  }

  findLowStock(): Supply[] {
    return this.store.supplies.filter((s) => s.quantity <= s.minStock);
  }

  findById(id: string): Supply | undefined {
    return this.store.getSupplyById(id);
  }

  nextId(): string {
    return this.store.nextId('sup', this.store.supplies);
  }

  create(data: Omit<Supply, 'id' | 'updatedAt'>): Supply {
    const supply: Supply = {
      id: this.nextId(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    this.store.supplies.push(supply);
    this.store.indexSupply(supply);
    return supply;
  }

  save(supply: Supply): Supply {
    this.store.replaceSupply(supply);
    return supply;
  }

  remove(id: string): boolean {
    return this.store.removeSupply(id);
  }
}
