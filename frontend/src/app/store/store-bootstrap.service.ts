import { inject, Injectable } from '@angular/core';
import { CatalogFacade } from './catalog/catalog.facade';
import { ImpresosFacade } from './impresos/impresos.facade';
import { SettingsFacade } from './settings/settings.facade';
import { SuppliesFacade } from './supplies/supplies.facade';

@Injectable({ providedIn: 'root' })
export class StoreBootstrapService {
  private readonly catalog = inject(CatalogFacade);
  private readonly settings = inject(SettingsFacade);
  private readonly impresos = inject(ImpresosFacade);
  private readonly supplies = inject(SuppliesFacade);

  bootstrap(refresh = false): void {
    this.catalog.load(refresh);
    this.settings.load(refresh);
    this.impresos.load(refresh);
    this.supplies.load(refresh);
  }
}
