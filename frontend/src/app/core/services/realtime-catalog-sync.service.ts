import { Injectable, inject } from '@angular/core';
import { RealtimeEvent } from '../models/realtime.model';
import { CategoryCatalogService } from './category-catalog.service';
import { CustomerCatalogService } from './customer-catalog.service';
import { ProductCatalogService } from './product-catalog.service';
import { ReferenceDataService } from './reference-data.service';

@Injectable({ providedIn: 'root' })
export class RealtimeCatalogSyncService {
  private readonly customerCatalog = inject(CustomerCatalogService);
  private readonly categoryCatalog = inject(CategoryCatalogService);
  private readonly productCatalog = inject(ProductCatalogService);
  private readonly referenceData = inject(ReferenceDataService);

  handleEvent(event: RealtimeEvent): void {
    if (event.scope === 'all') {
      this.invalidateAll();
      return;
    }

    if (!event.entity || !event.action) {
      this.invalidateForScope(event.scope);
      return;
    }

    if (event.action === 'delete' && event.id) {
      switch (event.entity) {
        case 'customer':
          this.customerCatalog.remove(event.id);
          break;
        case 'product':
          this.productCatalog.remove(event.id);
          break;
        case 'category':
          this.categoryCatalog.remove(event.id);
          break;
        default:
          this.invalidateForScope(event.scope);
      }
      return;
    }

    this.invalidateForScope(event.scope);
  }

  private invalidateAll(): void {
    this.referenceData.invalidate();
    this.customerCatalog.invalidate();
    this.categoryCatalog.invalidate();
    this.productCatalog.invalidate();
  }

  private invalidateForScope(scope: RealtimeEvent['scope']): void {
    switch (scope) {
      case 'customers':
        this.customerCatalog.invalidate();
        break;
      case 'products':
        this.categoryCatalog.invalidate();
        this.productCatalog.invalidate();
        break;
      default:
        break;
    }
  }
}
