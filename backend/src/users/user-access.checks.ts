import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  RolePermissionDto,
  UserPermissionOverrideDto,
} from '../common/dto';
import {
  RolePermissionEntry,
  UserPermissionOverrideEntry,
} from '../common/interfaces';

export async function validatePermissionReferences(
  db: PrismaClient,
  permissions: Array<RolePermissionEntry | UserPermissionOverrideEntry>,
): Promise<void> {
  const areaIds = [
    ...new Set(
      permissions
        .map((permission) => permission.areaId)
        .filter((areaId): areaId is string => !!areaId),
    ),
  ];

  if (areaIds.length === 0) return;

  const count = await db.workArea.count({
    where: { id: { in: areaIds } },
  });
  if (count !== areaIds.length) {
    throw new BadRequestException('Una o más áreas no existen');
  }
}

export async function assertUniqueUserEmail(
  db: PrismaClient,
  email: string,
  excludeId?: string,
): Promise<void> {
  const existing = await db.appUser.findFirst({
    where: {
      email,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new ConflictException('Ya existe un usuario con ese email');
  }
}

export async function assertUniqueFirebaseUid(
  db: PrismaClient,
  firebaseUid: string,
  excludeId?: string,
): Promise<void> {
  const existing = await db.appUser.findFirst({
    where: {
      firebaseUid,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new ConflictException(
      'Ya existe un usuario vinculado a esa cuenta de Firebase',
    );
  }
}

export function mapRolePermissions(
  permissions: RolePermissionDto[],
): RolePermissionEntry[] {
  return permissions.map((permission) => ({
    action: permission.action,
    areaId: permission.areaId ?? null,
  }));
}

export function mapUserOverrides(
  overrides: UserPermissionOverrideDto[],
): UserPermissionOverrideEntry[] {
  return overrides.map((override) => ({
    action: override.action,
    areaId: override.areaId ?? null,
    granted: override.granted,
  }));
}
