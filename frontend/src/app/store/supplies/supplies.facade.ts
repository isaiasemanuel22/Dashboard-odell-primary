import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Supply, SupplyCategory } from '../../core/models';
import { SuppliesActions } from './supplies.actions';
import {
  selectSuppliesFiltered,
  selectSuppliesLoaded,
  selectSuppliesLoading,
} from './supplies.selectors';

@Injectable({ providedIn: 'root' })
export class SuppliesFacade {
  private readonly store = inject(Store);

  readonly loaded$ = this.store.select(selectSuppliesLoaded);
  readonly loading$ = this.store.select(selectSuppliesLoading);

  load(refresh = false, category?: SupplyCategory): void {
    this.store.dispatch(
      SuppliesActions.load({ refresh, category }),
    );
  }

  refresh(): void {
    this.load(true);
  }

  supplies(category?: SupplyCategory): Observable<Supply[]> {
    return this.store.select(
      selectSuppliesFiltered({ category }),
    );
  }

  upsertSupply(supply: Supply): void {
    this.store.dispatch(SuppliesActions.upsertSupply({ supply }));
  }

  removeSupply(id: string): void {
    this.store.dispatch(SuppliesActions.removeSupply({ id }));
  }

  invalidate(): void {
    this.store.dispatch(SuppliesActions.invalidate());
  }
}
