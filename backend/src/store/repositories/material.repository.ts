import { Injectable } from '@nestjs/common';
import { Material } from '../../common/interfaces';
import { StoreService } from '../store.service';

@Injectable()
export class MaterialRepository {
  constructor(private readonly store: StoreService) {}

  findAll(): Material[] {
    return this.store.materials;
  }

  findLowStock(): Material[] {
    return this.store.materials.filter((m) => m.quantity <= m.minStock);
  }

  findById(id: string): Material | undefined {
    return this.store.getMaterialById(id);
  }

  save(material: Material): Material {
    this.store.replaceMaterial(material);
    return material;
  }
}
