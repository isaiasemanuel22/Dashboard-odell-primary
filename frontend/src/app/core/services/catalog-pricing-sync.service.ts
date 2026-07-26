import { Injectable, inject } from '@angular/core';
import { firstValueFrom, from, Observable } from 'rxjs';
import {
  GeneralSettings,
  Product,
  ProductPricingFields,
} from '../models';
import { ProductPricingService } from './product-pricing.service';
import {
  productToPricingInput,
  toProductPricingFields,
} from '../../shared/utils/product-pricing-input.util';

@Injectable({ providedIn: 'root' })
export class CatalogPricingSyncService {
  private readonly pricing = inject(ProductPricingService);

  /** Recalcula costo/precio/ganancia del catálogo en memoria (sin persistir en servidor). */
  recalculate(
    products: Product[],
    settings: GeneralSettings,
  ): Observable<ProductPricingFields[]> {
    return from(this.recalculateAll(products, settings));
  }

  private async recalculateAll(
    products: Product[],
    settings: GeneralSettings,
  ): Promise<ProductPricingFields[]> {
    if (!products.length) return [];

    let working = products.map((product) => ({ ...product }));

    for (let pass = 0; pass < 12; pass++) {
      let changed = false;
      const next: Product[] = [];

      for (const product of working) {
        const result = await firstValueFrom(
          this.pricing.preview(
            productToPricingInput(product, working),
            working,
            settings,
          ),
        );

        const updated: Product = {
          ...product,
          cost: result.cost,
          price: result.price,
          profit: result.profit,
        };

        if (
          updated.cost !== product.cost ||
          updated.price !== product.price ||
          updated.profit !== product.profit
        ) {
          changed = true;
        }

        next.push(updated);
      }

      working = next;
      if (!changed) break;
    }

    return working.map(toProductPricingFields);
  }
}
