import { Observable, of } from 'rxjs';
import { FormDialogService } from '../../modals/form-dialog.service';

export interface ConfirmMobileFormDiscardOptions {
  /** Hay cambios respecto de los valores iniciales. */
  hasChanges: boolean;
  /**
   * Sustantivo con artículo: «el cliente», «el insumo», «el evento»,
   * «el pedido», «los cambios».
   */
  entityLabel: string;
  /** La pide un guard de ruta: no cerrarla con la navegación en curso. */
  fromRouteGuard?: boolean;
}

/**
 * Confirmación de descarte unificada para formularios mobile.
 * Pregunta solo si hay cambios; si no, emite `true` de inmediato.
 */
export function confirmMobileFormDiscard(
  formDialogs: FormDialogService,
  options: ConfirmMobileFormDiscardOptions,
): Observable<boolean> {
  if (!options.hasChanges) {
    return of(true);
  }

  return formDialogs.openConfirm({
    title: 'Descartar cambios',
    message: `Hay cambios sin guardar. ¿Descartar ${options.entityLabel} y cerrar?`,
    confirmLabel: 'Descartar',
    cancelLabel: 'Seguir editando',
    confirmVariant: 'delete',
  }, { keepOnNavigation: options.fromRouteGuard });
}
