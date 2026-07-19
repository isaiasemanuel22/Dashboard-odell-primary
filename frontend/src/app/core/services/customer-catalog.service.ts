import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Customer } from '../models';
import { CatalogFacade } from '../../store/catalog/catalog.facade';

@Injectable({ providedIn: 'root' })
export class CustomerCatalogService {
  private readonly catalogFacade = inject(CatalogFacade);

  getCustomers(refresh = false): Observable<Customer[]> {
    return this.catalogFacade.getCustomersOnce(refresh);
  }

  seed(customers: Customer[]): void {
    for (const customer of customers) {
      this.catalogFacade.upsertCustomer(customer);
    }
  }

  upsert(customer: Customer): void {
    this.catalogFacade.upsertCustomer(customer);
  }

  remove(id: string): void {
    this.catalogFacade.removeCustomer(id);
  }

  invalidate(): void {
    this.catalogFacade.invalidate();
  }
}
