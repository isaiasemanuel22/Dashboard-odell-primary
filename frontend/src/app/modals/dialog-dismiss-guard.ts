import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { DialogRef } from '@angular/cdk/dialog';
import { filter } from 'rxjs';

/**
 * Mismo patrón que el diálogo de cliente: el click afuera y Esc no cierran
 * solos; llaman a `onDismiss`, que decide si pregunta «¿descartar?».
 */
export function guardDialogDismiss(
  dialogRef: DialogRef<any, any>,
  destroyRef: DestroyRef,
  onDismiss: () => void,
): void {
  dialogRef.disableClose = true;
  dialogRef.backdropClick
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe(() => onDismiss());
  dialogRef.keydownEvents
    .pipe(
      filter((event) => event.key === 'Escape'),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe((event) => {
      event.preventDefault();
      onDismiss();
    });
}
