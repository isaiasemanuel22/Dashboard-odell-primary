import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { Category, Customer, Product, ReferenceData } from '../models';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CategoryCatalogService } from './category-catalog.service';
import { CustomerCatalogService } from './customer-catalog.service';
import { ProductCatalogService } from './product-catalog.service';

@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  private readonly http = inject(HttpClient);
  private readonly customerCatalog = inject(CustomerCatalogService);
  private readonly categoryCatalog = inject(CategoryCatalogService);
  private readonly productCatalog = inject(ProductCatalogService);

  private cache$: Observable<ReferenceData> | null = null;

  load(refresh = false): Observable<ReferenceData> {
    if (refresh) {
      this.cache$ = null;
    }
    if (!this.cache$) {
      this.cache$ = this.http
        .get<ReferenceData>(`${environment.apiUrl}/reference-data`)
        .pipe(
          tap((data) => {
            this.customerCatalog.seed(data.customers);
            this.categoryCatalog.seed(data.categories);
            this.productCatalog.seed(data.products);
          }),
          shareReplay(1),
        );
    }
    return this.cache$;
  }

  invalidate(): void {
    this.cache$ = null;
  }
}
