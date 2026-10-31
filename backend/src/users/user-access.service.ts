import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import {
  CreateAppRoleDto,
  CreateAppUserDto,
  CreateWorkAreaDto,
  RolePermissionDto,
  UpdateAppRoleDto,
  UpdateAppUserDto,
  UpdateWorkAreaDto,
  UserPermissionOverrideDto,
} from '../common/dto';
import { PermissionAction } from '../common/enums';
import {
  AppRole,
  AppUser,
  CurrentUserProfile,
  RolePermissionEntry,
  UserPermissionOverrideEntry,
  WorkArea,
} from '../common/interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_ROLE_ID, buildUniqueAreaSlug } from './user-access.bootstrap';
import { UserAccessBootstrapService } from './user-access.bootstrap';
import {
  mapAppRoleFromDb,
  mapAppUserFromDb,
  mapWorkAreaFromDb,
} from './user-access.mapper';
import {
  hasPermission,
  normalizeRolePermissions,
  resolvePermissions,
  userIsAdmin,
} from './user-access.util';
import {
  assertUniqueFirebaseUid as assertFirebaseUidIsUnique,
  assertUniqueUserEmail as assertEmailIsUnique,
  mapRolePermissions as mapRolePermissionEntries,
  mapUserOverrides as mapUserOverrideEntries,
  validatePermissionReferences as validatePermissionAreaRefs,
} from './user-access.checks';

@Injectable()
export class UserAccessService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly bootstrap: UserAccessBootstrapService,
  ) {}

  private db() {
    if (!this.prismaService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Usuarios y permisos requieren DATABASE_URL configurada',
      );
    }
    return this.prismaService.prisma;
  }

  async listWorkAreas(): Promise<WorkArea[]> {
    const rows = await this.db().workArea.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(mapWorkAreaFromDb);
  }

  async findWorkArea(id: string): Promise<WorkArea> {
    const row = await this.db().workArea.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Área ${id} no encontrada`);
    }
    return mapWorkAreaFromDb(row);
  }

  async createWorkArea(data: CreateWorkAreaDto): Promise<WorkArea> {
    const name = data.name.trim();
    if (!name) {
      throw new BadRequestException('El nombre del área es obligatorio');
    }

    const existing = await this.db().workArea.findMany({ select: { slug: true } });
    const slug =
      data.slug?.trim() ||
      buildUniqueAreaSlug(name, new Set(existing.map((row) => row.slug)));

    if (existing.some((row) => row.slug === slug)) {
      throw new ConflictException('Ya existe un área con ese identificador');
    }

    const maxSort = await this.db().workArea.aggregate({
      _max: { sortOrder: true },
    });
    const now = new Date();
    const row = await this.db().workArea.create({
      data: {
        id: await this.nextId('area', 'workArea'),
        name,
        slug,
        active: data.active ?? true,
        sortOrder: data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
        createdAt: now,
        updatedAt: now,
      },
    });
    return mapWorkAreaFromDb(row);
  }

  async updateWorkArea(id: string, data: UpdateWorkAreaDto): Promise<WorkArea> {
    const current = await this.findWorkArea(id);
    const name = data.name !== undefined ? data.name.trim() : current.name;
    if (!name) {
      throw new BadRequestException('El nombre del área es obligatorio');
    }

    if (data.active === false && current.active) {
      await this.assertAreaCanDeactivate(id);
    }

    let slug = current.slug;
    if (data.slug !== undefined) {
      slug = data.slug.trim();
      if (!slug) {
        throw new BadRequestException('El identificador del área es obligatorio');
      }
      const duplicate = await this.db().workArea.findFirst({
        where: { slug, NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException('Ya existe un área con ese identificador');
      }
    }

    const row = await this.db().workArea.update({
      where: { id },
      data: {
        name,
        slug,
        active: data.active ?? current.active,
        sortOrder: data.sortOrder ?? current.sortOrder,
        updatedAt: new Date(),
      },
    });
    return mapWorkAreaFromDb(row);
  }

  async removeWorkArea(id: string): Promise<void> {
    const area = await this.findWorkArea(id);
    await this.assertAreaCanDeactivate(area.id);

    const permissionCount = await this.db().rolePermission.count({
      where: { areaId: id },
    });
    if (permissionCount > 0) {
      throw new ConflictException(
        'No se puede eliminar un área referenciada en permisos de roles',
      );
    }

    await this.db().workArea.delete({ where: { id } });
  }

  async listRoles(): Promise<AppRole[]> {
    const rows = await this.db().appRole.findMany({
      include: { permissions: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return rows.map(mapAppRoleFromDb);
  }

  async findRole(id: string): Promise<AppRole> {
    const row = await this.db().appRole.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!row) {
      throw new NotFoundException(`Rol ${id} no encontrado`);
    }
    return mapAppRoleFromDb(row);
  }

  async createRole(data: CreateAppRoleDto): Promise<AppRole> {
    const name = data.name.trim();
    if (!name) {
      throw new BadRequestException('El nombre del rol es obligatorio');
    }

    const permissions = normalizeRolePermissions(
      this.mapRolePermissions(data.permissions ?? []),
    );
    await this.validatePermissionReferences(permissions);

    const now = new Date();
    const row = await this.db().appRole.create({
      data: {
        id: await this.nextId('role', 'appRole'),
        name,
        description: data.description?.trim() || null,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
        permissions: {
          create: permissions.map((permission, index) => ({
            id: `perm-${Date.now()}-${index}`,
            areaId: permission.areaId,
            action: permission.action,
          })),
        },
      },
      include: { permissions: true },
    });
    return mapAppRoleFromDb(row);
  }

  async updateRole(id: string, data: UpdateAppRoleDto): Promise<AppRole> {
    const current = await this.findRole(id);
    const name = data.name !== undefined ? data.name.trim() : current.name;
    if (!name) {
      throw new BadRequestException('El nombre del rol es obligatorio');
    }

    const permissions =
      data.permissions !== undefined
        ? normalizeRolePermissions(this.mapRolePermissions(data.permissions))
        : current.permissions;

    if (data.permissions !== undefined) {
      await this.validatePermissionReferences(permissions);
    }

    const now = new Date();
    await this.db().$transaction([
      this.db().rolePermission.deleteMany({ where: { roleId: id } }),
      this.db().appRole.update({
        where: { id },
        data: {
          name,
          description:
            data.description !== undefined
              ? data.description.trim() || null
              : current.description ?? null,
          updatedAt: now,
          permissions: {
            create: permissions.map((permission, index) => ({
              id: `perm-${id}-${index}`,
              areaId: permission.areaId,
              action: permission.action,
            })),
          },
        },
      }),
    ]);

    return this.findRole(id);
  }

  async removeRole(id: string): Promise<void> {
    const role = await this.findRole(id);
    if (role.isSystem) {
      throw new ConflictException('No se puede eliminar un rol del sistema');
    }

    const assigned = await this.db().userRole.count({ where: { roleId: id } });
    if (assigned > 0) {
      throw new ConflictException(
        'No se puede eliminar un rol asignado a usuarios',
      );
    }

    await this.db().appRole.delete({ where: { id } });
  }

  async listUsers(): Promise<AppUser[]> {
    const rows = await this.db().appUser.findMany({
      include: {
        userRoles: true,
        permissionOverrides: true,
      },
      orderBy: [{ active: 'desc' }, { displayName: 'asc' }],
    });
    return rows.map(mapAppUserFromDb);
  }

  async findUser(id: string): Promise<AppUser> {
    const row = await this.db().appUser.findUnique({
      where: { id },
      include: {
        userRoles: true,
        permissionOverrides: true,
      },
    });
    if (!row) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }
    return mapAppUserFromDb(row);
  }

  async createUser(data: CreateAppUserDto): Promise<AppUser> {
    const email = data.email.trim().toLowerCase();
    const displayName = data.displayName.trim();
    if (!displayName) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    await this.assertUniqueUserEmail(email);
    if (data.firebaseUid) {
      await this.assertUniqueFirebaseUid(data.firebaseUid);
    }

    const roleIds = data.roleIds ?? [];
    await this.validateRoleIds(roleIds);
    const overrides = this.mapUserOverrides(data.permissionOverrides ?? []);
    await this.validatePermissionReferences(overrides);

    const now = new Date();
    const row = await this.db().appUser.create({
      data: {
        id: await this.nextId('user', 'appUser'),
        email,
        displayName,
        firebaseUid: data.firebaseUid?.trim() || null,
        active: data.active ?? true,
        createdAt: now,
        updatedAt: now,
        userRoles: {
          create: roleIds.map((roleId) => ({ roleId })),
        },
        permissionOverrides: {
          create: overrides.map((override, index) => ({
            id: `override-${Date.now()}-${index}`,
            areaId: override.areaId ?? null,
            action: override.action,
            granted: override.granted,
          })),
        },
      },
      include: {
        userRoles: true,
        permissionOverrides: true,
      },
    });
    return mapAppUserFromDb(row);
  }

  async updateUser(id: string, data: UpdateAppUserDto): Promise<AppUser> {
    const current = await this.findUser(id);
    const email =
      data.email !== undefined ? data.email.trim().toLowerCase() : current.email;
    const displayName =
      data.displayName !== undefined ? data.displayName.trim() : current.displayName;

    if (!displayName) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    if (email !== current.email) {
      await this.assertUniqueUserEmail(email, id);
    }

    if (data.firebaseUid !== undefined) {
      const uid = data.firebaseUid?.trim() || null;
      if (uid && uid !== current.firebaseUid) {
        await this.assertUniqueFirebaseUid(uid, id);
      }
    }

    if (data.roleIds !== undefined) {
      await this.validateRoleIds(data.roleIds);
    }

    const overrides = data.permissionOverrides;
    if (overrides !== undefined) {
      await this.validatePermissionReferences(this.mapUserOverrides(overrides));
    }

    const now = new Date();
    const operations = [
      this.db().userRole.deleteMany({ where: { userId: id } }),
      this.db().userPermissionOverride.deleteMany({ where: { userId: id } }),
      this.db().appUser.update({
        where: { id },
        data: {
          email,
          displayName,
          firebaseUid:
            data.firebaseUid !== undefined
              ? data.firebaseUid?.trim() || null
              : current.firebaseUid ?? null,
          active: data.active ?? current.active,
          updatedAt: now,
          userRoles: {
            create: (data.roleIds ?? current.roleIds).map((roleId) => ({
              roleId,
            })),
          },
          permissionOverrides: {
            create: (overrides ?? current.permissionOverrides).map(
              (override, index) => ({
                id: `override-${id}-${index}`,
                areaId: override.areaId ?? null,
                action: override.action,
                granted: override.granted,
              }),
            ),
          },
        },
      }),
    ];

    await this.db().$transaction(operations);
    return this.findUser(id);
  }

  async removeUser(id: string): Promise<void> {
    await this.findUser(id);
    await this.db().appUser.delete({ where: { id } });
  }

  async resolveCurrentUser(
    token?: DecodedIdToken,
  ): Promise<CurrentUserProfile | null> {
    if (!token?.uid) return null;

    try {
      await this.bootstrap.syncDefaults();

      let user = await this.findUserByFirebaseUid(token.uid);
      if (!user) {
        user = await this.findUserByEmail(token.email?.toLowerCase() ?? '');
      }

      if (!user) {
        const userCount = await this.db().appUser.count();
        if (userCount === 0) {
          user = await this.bootstrapFirstAdmin(token);
        }
      }

      if (!user) return null;

      if (!user.firebaseUid) {
        user = await this.linkFirebaseUid(user.id, token.uid);
      }

      if (!user.active) {
        throw new ForbiddenException('Tu usuario está desactivado');
      }

      const roles = await this.loadRolesForUser(user.roleIds);
      const permissions = resolvePermissions(roles, user.permissionOverrides);

      return {
        ...user,
        roles,
        permissions,
        isAdmin: userIsAdmin(permissions),
      };
    } catch (error) {
      if (this.isMissingSchemaError(error)) {
        return null;
      }
      throw error;
    }
  }

  async assertActorCanManage(
    actor: CurrentUserProfile | null,
    action: PermissionAction,
  ): Promise<void> {
    if (!actor) {
      throw new ForbiddenException('Autenticación requerida');
    }
    if (!hasPermission(actor.permissions, action)) {
      throw new ForbiddenException('No tenés permiso para esta acción');
    }
  }

  private isMissingSchemaError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('does not exist');
  }

  private async bootstrapFirstAdmin(token: DecodedIdToken): Promise<AppUser> {
    const email = token.email?.trim().toLowerCase();
    const displayName =
      token.name?.trim() ||
      email?.split('@')[0] ||
      'Administrador';

    if (!email) {
      throw new BadRequestException(
        'La cuenta de Firebase debe tener email para crear el administrador inicial',
      );
    }

    return this.createUser({
      email,
      displayName,
      firebaseUid: token.uid,
      roleIds: [ADMIN_ROLE_ID],
      active: true,
    });
  }

  private async linkFirebaseUid(userId: string, firebaseUid: string): Promise<AppUser> {
    await this.assertUniqueFirebaseUid(firebaseUid, userId);
    await this.db().appUser.update({
      where: { id: userId },
      data: { firebaseUid, updatedAt: new Date() },
    });
    return this.findUser(userId);
  }

  private async findUserByFirebaseUid(uid: string): Promise<AppUser | null> {
    const row = await this.db().appUser.findUnique({
      where: { firebaseUid: uid },
      include: {
        userRoles: true,
        permissionOverrides: true,
      },
    });
    return row ? mapAppUserFromDb(row) : null;
  }

  private async findUserByEmail(email: string): Promise<AppUser | null> {
    if (!email) return null;
    const row = await this.db().appUser.findFirst({
      where: { email },
      include: {
        userRoles: true,
        permissionOverrides: true,
      },
    });
    return row ? mapAppUserFromDb(row) : null;
  }

  private async loadRolesForUser(roleIds: string[]): Promise<AppRole[]> {
    if (roleIds.length === 0) return [];
    const rows = await this.db().appRole.findMany({
      where: { id: { in: roleIds } },
      include: { permissions: true },
    });
    return rows.map(mapAppRoleFromDb);
  }

  private async validateRoleIds(roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;
    const count = await this.db().appRole.count({
      where: { id: { in: roleIds } },
    });
    if (count !== roleIds.length) {
      throw new BadRequestException('Uno o más roles no existen');
    }
  }

  private async validatePermissionReferences(
    permissions: Array<RolePermissionEntry | UserPermissionOverrideEntry>,
  ): Promise<void> {
    await validatePermissionAreaRefs(this.db(), permissions);
  }

  private async assertUniqueUserEmail(
    email: string,
    excludeId?: string,
  ): Promise<void> {
    await assertEmailIsUnique(this.db(), email, excludeId);
  }

  private async assertUniqueFirebaseUid(
    firebaseUid: string,
    excludeId?: string,
  ): Promise<void> {
    await assertFirebaseUidIsUnique(this.db(), firebaseUid, excludeId);
  }

  private async assertAreaCanDeactivate(areaId: string): Promise<void> {
    // Cuando las tareas tengan areaId, validar estados activos (§22).
    void areaId;
  }

  private mapRolePermissions(
    permissions: RolePermissionDto[],
  ): RolePermissionEntry[] {
    return mapRolePermissionEntries(permissions);
  }

  private mapUserOverrides(
    overrides: UserPermissionOverrideDto[],
  ): UserPermissionOverrideEntry[] {
    return mapUserOverrideEntries(overrides);
  }

  private async nextId(
    prefix: string,
    model: 'workArea' | 'appRole' | 'appUser',
  ): Promise<string> {
    const db = this.db();
    const rows =
      model === 'workArea'
        ? await db.workArea.findMany({ select: { id: true } })
        : model === 'appRole'
          ? await db.appRole.findMany({ select: { id: true } })
          : await db.appUser.findMany({ select: { id: true } });

    const numbers = rows
      .map((row) => parseInt(row.id.split('-')[1] ?? '0', 10))
      .filter((value) => !Number.isNaN(value));
    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return `${prefix}-${next}`;
  }
}
