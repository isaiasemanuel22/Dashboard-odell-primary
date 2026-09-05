import {
  AppRole as DbAppRole,
  AppUser as DbAppUser,
  RolePermission as DbRolePermission,
  UserPermissionOverride as DbUserPermissionOverride,
  WorkArea as DbWorkArea,
} from '@prisma/client';
import { PermissionAction } from '../common/enums';
import {
  AppRole,
  AppUser,
  RolePermissionEntry,
  UserPermissionOverrideEntry,
  WorkArea,
} from '../common/interfaces';

type DbRoleWithPermissions = DbAppRole & {
  permissions: DbRolePermission[];
};

type DbUserWithRelations = DbAppUser & {
  userRoles: { roleId: string }[];
  permissionOverrides: DbUserPermissionOverride[];
};

export function mapWorkAreaFromDb(row: DbWorkArea): WorkArea {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapRolePermissionFromDb(
  row: DbRolePermission,
): RolePermissionEntry {
  return {
    action: row.action as PermissionAction,
    areaId: row.areaId,
  };
}

export function mapAppRoleFromDb(row: DbRoleWithPermissions): AppRole {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    isSystem: row.isSystem,
    permissions: row.permissions.map(mapRolePermissionFromDb),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapUserOverrideFromDb(
  row: DbUserPermissionOverride,
): UserPermissionOverrideEntry {
  return {
    action: row.action as PermissionAction,
    areaId: row.areaId,
    granted: row.granted,
  };
}

export function mapAppUserFromDb(row: DbUserWithRelations): AppUser {
  return {
    id: row.id,
    firebaseUid: row.firebaseUid ?? undefined,
    email: row.email,
    displayName: row.displayName,
    active: row.active,
    roleIds: row.userRoles.map((entry) => entry.roleId),
    permissionOverrides: row.permissionOverrides.map(mapUserOverrideFromDb),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
