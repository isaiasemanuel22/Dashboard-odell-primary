import { Injectable, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { Observable, of } from 'rxjs';
import { confirmMobileFormDiscard } from '../components/mobile-form-shell/confirm-mobile-form-discard';
import { FormDialogService } from './form-dialog.service';

/**
 * Un diálogo de formulario abierto avisa acá si tiene cambios sin guardar,
 * para que un guard de ruta pregunte "¿descartar?" antes de navegar.
 */
@Injectable({ providedIn: 'root' })
export class UnsavedDialogRegistry {
  private entries: { check: () => boolean; label: string }[] = [];

  register(hasChanges: () => boolean, entityLabel: string): () => void {
    const entry = { check: hasChanges, label: entityLabel };
    this.entries.push(entry);
    return () => {
      this.entries = this.entries.filter((item) => item !== entry);
    };
  }

  get pendingLabel(): string | null {
    return this.entries.find((item) => item.check())?.label ?? null;
  }
}

/** Reusa `confirmMobileFormDiscard` (el mismo aviso que el resto de formularios). */
export const unsavedDialogGuard: CanDeactivateFn<unknown> = ():
  | Observable<boolean>
  | boolean => {
  const label = inject(UnsavedDialogRegistry).pendingLabel;
  if (!label) return of(true);
  return confirmMobileFormDiscard(inject(FormDialogService), {
    hasChanges: true,
    entityLabel: label,
    fromRouteGuard: true,
  });
};
