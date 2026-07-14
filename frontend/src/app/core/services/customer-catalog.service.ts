import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay } from 'rxjs';
import { Customer } from '../models';
import { CustomersService } from './customers.service';
import { removeById, upsertById } from '../utils/replace-in-store';

@Injectable({ providedIn: 'root' })
export class CustomerCatalogService {
  private readonly customersService = inject(CustomersService);
  private cache$: Observable<Customer[]> | null = null;
  private snapshot: Customer[] = [];

  getCustomers(refresh = false): Observable<Customer[]> {
    if (refresh) {
      this.cache$ = null;
    }
    if (!this.cache$) {
      this.cache$ = this.customersService.getCustomers().pipe(
        shareReplay(1),
      );
      this.cache$.subscribe((customers) => {
        this.snapshot = customers;
      });
    }
    return this.cache$;
  }

  seed(customers: Customer[]): void {
    this.snapshot = [...customers];
    this.cache$ = of(this.snapshot).pipe(shareReplay(1));
  }

  upsert(customer: Customer): void {
    this.snapshot = upsertById(this.snapshot, customer);
    this.cache$ = of([...this.snapshot]).pipe(shareReplay(1));
  }

  remove(id: string): void {
    this.snapshot = removeById(this.snapshot, id);
    this.cache$ = of([...this.snapshot]).pipe(shareReplay(1));
  }

  invalidate(): void {
    this.cache$ = null;
    this.snapshot = [];
  }
}
