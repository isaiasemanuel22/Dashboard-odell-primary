import { ChangeDetectorRef } from '@angular/core';
import { Observable, tap } from 'rxjs';

/** Marca el componente OnPush para re-renderizar tras respuestas HTTP. */
export function detectChanges<T>(cdr: ChangeDetectorRef) {
  return (source: Observable<T>) =>
    source.pipe(
      tap({
        next: () => cdr.markForCheck(),
        error: () => cdr.markForCheck(),
      }),
    );
}
