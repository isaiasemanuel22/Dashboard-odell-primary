import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Supply, SupplyCategory, SupplyType } from '../../core/models';
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

  load(refresh = false, supplyType?: SupplyType, category?: SupplyCategory): void {
    this.store.dispatch(
      SuppliesActions.load({ refresh, supplyType, category }),
    );
  }

  supplies(
    supplyType?: SupplyType,
    category?: SupplyCategory,
  ): Observable<Supply[]> {
    return this.store.select(
      selectSuppliesFiltered({ type: supplyType, category }),
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
