import type { Request } from 'express';
import { PrintJobActor } from '../common/interfaces';
import { ADMIN_ROLE_ID } from '../users/user-access.bootstrap';

/**
 * Actor para mover/asignar tareas.
 * En local sin Bearer (REQUIRE_AUTH=false) no hay request.user: se trata como admin.
 */
export function actorFromRequest(
  request: Pick<Request, 'user'> & { appUser?: Request['appUser'] },
  requireAuth: boolean,
): PrintJobActor {
  if (!request.user && !requireAuth) {
    return { userId: undefined, isAdmin: true };
  }
  const profile = request.appUser;
  return {
    userId: request.user?.uid,
    isAdmin:
      !!profile &&
      (profile.isAdmin || profile.roleIds.includes(ADMIN_ROLE_ID)),
  };
}
