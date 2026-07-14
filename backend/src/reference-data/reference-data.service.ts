import { Injectable } from '@nestjs/common';
import { ReferenceData } from '../common/interfaces';
import { StoreService } from '../store/store.service';

@Injectable()
export class ReferenceDataService {
  constructor(private readonly store: StoreService) {}

  getAll(): ReferenceData {
    return {
      customers: [...this.store.customers],
      categories: [...this.store.categories],
      products: [...this.store.products],
    };
  }
}
