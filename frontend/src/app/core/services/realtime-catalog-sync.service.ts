import { Injectable, inject } from '@angular/core';
import { RealtimeEvent } from '../models/realtime.model';
import { CatalogFacade } from '../../store/catalog/catalog.facade';
import { ImpresosFacade } from '../../store/impresos/impresos.facade';
import { SettingsFacade } from '../../store/settings/settings.facade';
import { SuppliesFacade } from '../../store/supplies/supplies.facade';
import { StoreBootstrapService } from '../../store/store-bootstrap.service';

@Injectable({ providedIn: 'root' })
export class RealtimeCatalogSyncService {
  private readonly catalogFacade = inject(CatalogFacade);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly impresosFacade = inject(ImpresosFacade);
  private readonly suppliesFacade = inject(SuppliesFacade);
  private readonly storeBootstrap = inject(StoreBootstrapService);

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
          this.catalogFacade.removeCustomer(event.id);
          break;
        case 'product':
          this.catalogFacade.removeProduct(event.id);
          break;
        case 'category':
          this.catalogFacade.removeCategory(event.id);
          break;
        default:
          this.invalidateForScope(event.scope);
      }
      return;
    }

    this.invalidateForScope(event.scope);
  }

  private invalidateAll(): void {
    this.catalogFacade.invalidate();
    this.settingsFacade.invalidate();
    this.impresosFacade.invalidate();
    this.suppliesFacade.invalidate();
    this.storeBootstrap.bootstrap(true);
  }

  private invalidateForScope(scope: RealtimeEvent['scope']): void {
    switch (scope) {
      case 'customers':
        this.catalogFacade.load(true);
        break;
      case 'products':
        this.catalogFacade.load(true);
        break;
      case 'settings':
        this.settingsFacade.load(true);
        this.impresosFacade.load(true);
        this.suppliesFacade.load(true);
        break;
      case 'supplies':
        this.suppliesFacade.load(true);
        break;
      default:
        break;
    }
  }
}
