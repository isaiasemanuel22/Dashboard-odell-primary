import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { ImpresoWithCost, PaperType } from '../../core/models';
import { ImpresosActions } from './impresos.actions';
import {
  selectImpresos,
  selectImpresosByPaperType,
  selectImpresosLoaded,
  selectImpresosLoading,
} from './impresos.selectors';

@Injectable({ providedIn: 'root' })
export class ImpresosFacade {
  private readonly store = inject(Store);

  readonly impresos$ = this.store.select(selectImpresos);
  readonly loaded$ = this.store.select(selectImpresosLoaded);
  readonly loading$ = this.store.select(selectImpresosLoading);

  load(refresh = false, paperType?: PaperType): void {
    this.store.dispatch(ImpresosActions.load({ refresh, paperType }));
  }

  impresos(paperType?: PaperType): Observable<ImpresoWithCost[]> {
    return this.store.select(selectImpresosByPaperType(paperType));
  }

  upsertImpreso(impreso: ImpresoWithCost): void {
    this.store.dispatch(ImpresosActions.upsertImpreso({ impreso }));
  }

  removeImpreso(id: string): void {
    this.store.dispatch(ImpresosActions.removeImpreso({ id }));
  }

  invalidate(): void {
    this.store.dispatch(ImpresosActions.invalidate());
  }
}
