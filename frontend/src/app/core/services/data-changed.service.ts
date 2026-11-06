import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

/** Ámbitos de listas/pantallas que deben refrescarse tras un alta o edición local. */
export type DataChangedScope =
  | 'orders'
  | 'quotes'
  | 'customers'
  | 'products'
  | 'supplies'
  | 'print-jobs';

export interface DataChangedEvent {
  scope: DataChangedScope;
}

/**
 * Aviso in-app cuando se crea/edita un registro desde un diálogo global
 * (p. ej. el «+» del menú inferior) y la ruta ya está montada.
 */
@Injectable({ providedIn: 'root' })
export class DataChangedService {
  private readonly subject = new Subject<DataChangedEvent>();

  readonly changes$: Observable<DataChangedEvent> = this.subject.asObservable();

  emit(scope: DataChangedScope): void {
    this.subject.next({ scope });
  }

  on(scope: DataChangedScope | DataChangedScope[]): Observable<DataChangedEvent> {
    const scopes = new Set(Array.isArray(scope) ? scope : [scope]);
    return this.changes$.pipe(filter((event) => scopes.has(event.scope)));
  }
}
