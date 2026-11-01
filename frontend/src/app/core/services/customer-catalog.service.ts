import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap, tap } from 'rxjs';
import { Customer, CustomerType } from '../models';
import { CatalogFacade } from '../../store/catalog/catalog.facade';
import { CustomersService } from './customers.service';

function normalizeCustomer(customer: Customer): Customer {
  return {
    ...customer,
    type: customer.type ?? CustomerType.PARTICULAR,
  };
}

function customersMissingType(customers: Customer[]): boolean {
  return customers.some(
    (customer) =>
      customer.type == null ||
      (customer.type as string) === '' ||
      !(Object.values(CustomerType) as string[]).includes(customer.type),
  );
}

@Injectable({ providedIn: 'root' })
export class CustomerCatalogService {
  private readonly catalogFacade = inject(CatalogFacade);
  private readonly customersApi = inject(CustomersService);

  /**
   * Clientes del catálogo. Si el cache no trae `type` (p. ej. datos viejos),
   * recarga desde `/customers` para poder detectar revendedores.
   */
  getCustomers(refresh = false): Observable<Customer[]> {
    if (refresh) {
      return this.refreshFromApi();
    }

    return this.catalogFacade.getCustomersOnce(false).pipe(
      switchMap((cached) => {
        const normalized = cached.map(normalizeCustomer);
        if (!cached.length || customersMissingType(cached)) {
          return this.refreshFromApi();
        }
        return of(normalized);
      }),
    );
  }

  /** Recarga `/customers` y sincroniza el catálogo (incluye type / wholesaleMinimum). */
  refreshFromApi(): Observable<Customer[]> {
    return this.customersApi.getCustomers().pipe(
      map((customers) => customers.map(normalizeCustomer)),
      tap((customers) => {
        for (const customer of customers) {
          this.catalogFacade.upsertCustomer(customer);
        }
      }),
    );
  }

  seed(customers: Customer[]): void {
    for (const customer of customers) {
      this.catalogFacade.upsertCustomer(normalizeCustomer(customer));
    }
  }

  upsert(customer: Customer): void {
    this.catalogFacade.upsertCustomer(normalizeCustomer(customer));
  }

  remove(id: string): void {
    this.catalogFacade.removeCustomer(id);
  }

  invalidate(): void {
    this.catalogFacade.invalidate();
  }
}
