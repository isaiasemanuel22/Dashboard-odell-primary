import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { confirmMobileFormDiscard } from '../../components/mobile-form-shell/confirm-mobile-form-discard';
import { FormDialogService } from '../../modals/form-dialog.service';

/**
 * Pantallas de Ajustes que avisan al salir con cambios sin guardar (mobile).
 */
export interface SettingsUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Guard reutilizable: en mobile, si hay cambios sin guardar, pregunta con
 * `confirmMobileFormDiscard` antes de abandonar la ruta.
 */
export const settingsUnsavedChangesGuard: CanDeactivateFn<
  SettingsUnsavedChanges
> = (component): Observable<boolean> | boolean => {
  const breakpoint = inject(BreakpointService);
  if (!breakpoint.isMobile()) {
    return true;
  }
  if (!component?.hasUnsavedChanges?.()) {
    return true;
  }
  return confirmMobileFormDiscard(inject(FormDialogService), {
    hasChanges: true,
    entityLabel: 'los cambios',
    fromRouteGuard: true,
  });
};

/** Serializa un valor para comparar estado guardado vs edición. */
export function settingsSnapshot(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/**
 * Baseline de edición para pantallas de ajustes.
 * Sirve para no pisar cambios locales cuando el store re-emite la misma
 * configuración (p. ej. tras ensureLoaded / realtime).
 */
export class SettingsEditBaseline {
  private savedSnapshot = '';

  capture(value: unknown): void {
    this.savedSnapshot = settingsSnapshot(value);
  }

  isDirty(value: unknown): boolean {
    return settingsSnapshot(value) !== this.savedSnapshot;
  }
}
