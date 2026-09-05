import {
  ADMIN_PERMISSION_ACTIONS,
  PermissionAction,
  WORK_PERMISSION_ACTIONS,
} from '../common/enums';
import {
  AppRole,
  ResolvedPermissionEntry,
  RolePermissionEntry,
  UserPermissionOverrideEntry,
} from '../common/interfaces';

export function permissionKey(
  action: PermissionAction,
  areaId: string | null | undefined,
): string {
  return `${action}:${areaId ?? '*'}`;
}

export function isAdminPermission(action: PermissionAction): boolean {
  return ADMIN_PERMISSION_ACTIONS.includes(action);
}

export function isWorkPermission(action: PermissionAction): boolean {
  return WORK_PERMISSION_ACTIONS.includes(action);
}

export function resolvePermissions(
  roles: AppRole[],
  overrides: UserPermissionOverrideEntry[],
): ResolvedPermissionEntry[] {
  const granted = new Map<string, ResolvedPermissionEntry>();
  const denied = new Set<string>();

  for (const role of roles) {
    for (const permission of role.permissions) {
      const key = permissionKey(permission.action, permission.areaId);
      denied.delete(key);
      granted.set(key, {
        action: permission.action,
        areaId: permission.areaId,
        granted: true,
      });
    }
  }

  for (const override of overrides) {
    const key = permissionKey(override.action, override.areaId);
    if (override.granted) {
      denied.delete(key);
      granted.set(key, {
        action: override.action,
        areaId: override.areaId,
        granted: true,
      });
    } else {
      granted.delete(key);
      denied.add(key);
    }
  }

  const resolved = [...granted.values()];
  for (const key of denied) {
    const [action, areaToken] = key.split(':');
    resolved.push({
      action: action as PermissionAction,
      areaId: areaToken === '*' ? null : areaToken,
      granted: false,
    });
  }

  return resolved.sort((left, right) =>
    permissionKey(left.action, left.areaId).localeCompare(
      permissionKey(right.action, right.areaId),
    ),
  );
}

export function hasPermission(
  permissions: ResolvedPermissionEntry[],
  action: PermissionAction,
  areaId?: string | null,
): boolean {
  const explicitDeny = permissions.some(
    (entry) =>
      !entry.granted &&
      entry.action === action &&
      (entry.areaId === (areaId ?? null) ||
        (areaId != null && entry.areaId === null)),
  );
  if (explicitDeny) return false;

  const globalGrant = permissions.some(
    (entry) =>
      entry.granted &&
      entry.action === action &&
      entry.areaId === null,
  );
  if (globalGrant) return true;

  if (areaId == null) {
    return permissions.some(
      (entry) => entry.granted && entry.action === action,
    );
  }

  return permissions.some(
    (entry) =>
      entry.granted &&
      entry.action === action &&
      entry.areaId === areaId,
  );
}

export function userIsAdmin(permissions: ResolvedPermissionEntry[]): boolean {
  return (
    hasPermission(permissions, PermissionAction.MANAGE_USERS) &&
    hasPermission(permissions, PermissionAction.MANAGE_ROLES) &&
    hasPermission(permissions, PermissionAction.MANAGE_AREAS)
  );
}

export function normalizeRolePermissions(
  permissions: RolePermissionEntry[],
): RolePermissionEntry[] {
  const unique = new Map<string, RolePermissionEntry>();

  for (const permission of permissions) {
    if (isAdminPermission(permission.action) && permission.areaId) {
      continue;
    }
    if (isWorkPermission(permission.action) && !permission.areaId) {
      continue;
    }

    const key = permissionKey(permission.action, permission.areaId);
    unique.set(key, {
      action: permission.action,
      areaId: permission.areaId ?? null,
    });
  }

  return [...unique.values()];
}

export function slugifyAreaName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
