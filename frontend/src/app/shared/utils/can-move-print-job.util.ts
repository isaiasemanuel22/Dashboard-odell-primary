import { CurrentUserResponse, PrintJob } from '../../core/models';

/**
 * Misma regla que el tablero/cola: admin o responsable de la tarea.
 * Con auth deshabilitada en local (`authenticated: false`) se permite mover.
 */
export function canMovePrintJob(
  job: PrintJob,
  profile: CurrentUserResponse | null,
): boolean {
  if (!profile) return false;
  if ('authenticated' in profile && profile.authenticated === false) {
    return true;
  }
  if (!('isAdmin' in profile)) return false;
  if (profile.isAdmin) return true;
  return !!profile.firebaseUid && profile.firebaseUid === job.responsibleUserId;
}
