import { PermissionAction, CurrentUserProfile } from '../../../core/models';

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  [PermissionAction.VIEW]: 'Ver',
  [PermissionAction.CREATE]: 'Crear',
  [PermissionAction.MODIFY]: 'Modificar',
  [PermissionAction.CANCEL]: 'Cancelar',
  [PermissionAction.APPROVE]: 'Aprobar',
  [PermissionAction.MANAGE_USERS]: 'Gestionar usuarios',
  [PermissionAction.MANAGE_ROLES]: 'Gestionar roles',
  [PermissionAction.MANAGE_AREAS]: 'Gestionar áreas',
};

export function isCurrentUserProfile(value: unknown): value is CurrentUserProfile {
  return (
    !!value &&
    typeof value === 'object' &&
    'id' in value &&
    'permissions' in value
  );
}
