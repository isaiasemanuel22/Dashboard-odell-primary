import { ForbiddenException } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserAccessBootstrapService } from './user-access.bootstrap';
import { UserAccessService } from './user-access.service';

describe('UserAccessService.resolveCurrentUser cache', () => {
  const token = {
    uid: 'firebase-1',
    email: 'ana@test.com',
    name: 'Ana',
  } as unknown as DecodedIdToken;

  const userRow = {
    id: 'user-1',
    email: 'ana@test.com',
    displayName: 'Ana',
    firebaseUid: 'firebase-1',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    userRoles: [{ roleId: 'role-op' }],
    permissionOverrides: [],
  };

  const roleRow = {
    id: 'role-op',
    name: 'Operador',
    description: null,
    isSystem: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    permissions: [],
  };

  let findUniqueUser: jest.Mock;
  let findManyRoles: jest.Mock;
  let syncDefaults: jest.Mock;
  let service: UserAccessService;
  let prisma: {
    appUser: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
    appRole: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    findUniqueUser = jest.fn().mockResolvedValue(userRow);
    findManyRoles = jest.fn().mockResolvedValue([roleRow]);
    syncDefaults = jest.fn().mockResolvedValue(undefined);

    prisma = {
      appUser: {
        findUnique: findUniqueUser,
        findMany: jest.fn().mockResolvedValue([userRow]),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      appRole: {
        findMany: findManyRoles,
      },
    };

    const prismaService = {
      isConfigured: () => true,
      prisma,
    } as unknown as PrismaService;

    const bootstrap = {
      syncDefaults,
    } as unknown as UserAccessBootstrapService;

    service = new UserAccessService(prismaService, bootstrap);
  });

  it('la segunda llamada no consulta la base', async () => {
    const first = await service.resolveCurrentUser(token);
    const second = await service.resolveCurrentUser(token);

    expect(first?.id).toBe('user-1');
    expect(second).toEqual(first);
    expect(findUniqueUser).toHaveBeenCalledTimes(1);
    expect(findManyRoles).toHaveBeenCalledTimes(1);
    expect(syncDefaults).not.toHaveBeenCalled();
  });

  it('se invalida al cambiar un usuario', async () => {
    await service.resolveCurrentUser(token);
    expect(findUniqueUser).toHaveBeenCalledTimes(1);

    await service.removeUser('user-1');

    findUniqueUser.mockClear();
    findManyRoles.mockClear();
    findUniqueUser.mockResolvedValue(userRow);

    await service.resolveCurrentUser(token);
    expect(findUniqueUser).toHaveBeenCalledTimes(1);
  });

  describe('identificación por email', () => {
    const intruder = {
      uid: 'firebase-intruso',
      email: 'ana@test.com',
    };

    let findFirstUser: jest.Mock;

    beforeEach(() => {
      // Por uid no lo encuentra; por email sí (ya vinculado a firebase-1).
      findUniqueUser.mockResolvedValue(null);
      findFirstUser = jest.fn().mockResolvedValue(userRow);
      // Hay usuarios: no corresponde el alta del primer administrador.
      Object.assign(prisma.appUser, {
        findFirst: findFirstUser,
        count: jest.fn().mockResolvedValue(1),
      });
    });

    it('no acepta un email sin verificar', async () => {
      const result = await service.resolveCurrentUser({
        ...intruder,
        email_verified: false,
      } as unknown as DecodedIdToken);

      expect(result).toBeNull();
      expect(findFirstUser).not.toHaveBeenCalled();
    });

    it('no toma un usuario ya vinculado a otra cuenta de Firebase', async () => {
      const result = await service.resolveCurrentUser({
        ...intruder,
        email_verified: true,
      } as unknown as DecodedIdToken);

      expect(findFirstUser).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  it('usuario inactivo lanza Forbidden', async () => {
    findUniqueUser.mockResolvedValue({ ...userRow, active: false });

    await expect(service.resolveCurrentUser(token)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('UserAccessService administrador por ADMIN_EMAIL', () => {
  const adminRow = {
    id: 'user-admin',
    email: 'dueno@test.com',
    displayName: 'Dueño',
    firebaseUid: 'firebase-dueno',
    active: true,
    roleIds: ['role-admin'],
    permissionOverrides: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  function build(found: Partial<typeof adminRow> | null) {
    const prismaService = {
      isConfigured: () => true,
      prisma: { appRole: { findMany: jest.fn().mockResolvedValue([]) } },
    } as unknown as PrismaService;
    const bootstrap = {
      syncDefaults: jest.fn().mockResolvedValue(undefined),
    } as unknown as UserAccessBootstrapService;
    const config = { adminEmail: 'dueno@test.com' } as AppConfigService;
    const service = new UserAccessService(prismaService, bootstrap, config);

    const internals = service as unknown as {
      findUserByFirebaseUid: jest.Mock;
      findUserByEmail: jest.Mock;
    };
    internals.findUserByFirebaseUid = jest.fn().mockResolvedValue(null);
    internals.findUserByEmail = jest
      .fn()
      .mockResolvedValue(found ? { ...adminRow, ...found } : null);
    const createUser = jest
      .spyOn(service, 'createUser')
      .mockResolvedValue(adminRow);
    const updateUser = jest
      .spyOn(service, 'updateUser')
      .mockResolvedValue(adminRow);
    return { service, createUser, updateUser, internals };
  }

  const dueno = (verified: boolean) =>
    ({
      uid: 'firebase-dueno',
      email: 'Dueno@Test.com',
      email_verified: verified,
    }) as unknown as DecodedIdToken;

  it('crea al administrador si no existe', async () => {
    const { service, createUser } = build(null);

    const profile = await service.resolveCurrentUser(dueno(true));

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'dueno@test.com',
        roleIds: ['role-admin'],
        active: true,
      }),
    );
    expect(profile?.id).toBe('user-admin');
  });

  it('reactiva y devuelve el rol de admin si lo había perdido', async () => {
    const { service, updateUser } = build({
      active: false,
      roleIds: ['role-op'],
    });

    await service.resolveCurrentUser(dueno(true));

    expect(updateUser).toHaveBeenCalledWith('user-admin', {
      active: true,
      roleIds: ['role-op', 'role-admin'],
    });
  });

  it('con el email sin verificar no lo trata como administrador', async () => {
    const { service, createUser, updateUser, internals } = build(null);

    const profile = await service.resolveCurrentUser(dueno(false));

    expect(profile).toBeNull();
    expect(createUser).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(internals.findUserByEmail).not.toHaveBeenCalled();
  });
});

describe('UserAccessService.listOrderResponsibles', () => {
  const rows = [
    {
      id: 'u-fb',
      displayName: 'Con Firebase',
      firebaseUid: 'fb-1',
      active: true,
    },
    {
      id: 'u-local',
      displayName: 'Solo local',
      firebaseUid: null,
      active: true,
    },
  ];

  function buildService(requireAuth: boolean) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const prismaService = {
      isConfigured: () => true,
      prisma: { appUser: { findMany } },
    } as unknown as PrismaService;
    const bootstrap = {
      syncDefaults: jest.fn(),
    } as unknown as UserAccessBootstrapService;
    const config = { requireAuth } as AppConfigService;
    return {
      findMany,
      service: new UserAccessService(prismaService, bootstrap, config),
    };
  }

  it('sin auth incluye usuarios locales con id local:<id>', async () => {
    const { service, findMany } = buildService(false);
    const result = await service.listOrderResponsibles();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'u-fb',
          firebaseUid: 'fb-1',
        }),
        expect.objectContaining({
          id: 'u-local',
          firebaseUid: 'local:u-local',
          displayName: 'Solo local',
        }),
      ]),
    );
  });

  it('con auth solo usuarios con firebaseUid', async () => {
    const { service, findMany } = buildService(true);
    findMany.mockResolvedValue([rows[0]]);
    const result = await service.listOrderResponsibles();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true, firebaseUid: { not: null } },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].firebaseUid).toBe('fb-1');
  });
});

describe('UserAccessService protección de administradores', () => {
  const date = new Date('2026-01-01T00:00:00.000Z');
  const adminPerms = ['manage_users', 'manage_roles', 'manage_areas'].map(
    (action, i) => ({
      id: `p${i}`,
      roleId: 'role-admin',
      areaId: null,
      action,
    }),
  );
  const adminRole = {
    id: 'role-admin',
    name: 'Admin',
    description: null,
    isSystem: true,
    createdAt: date,
    updatedAt: date,
    permissions: adminPerms,
  };
  const adminUser = {
    id: 'u-admin',
    email: 'a@test.com',
    displayName: 'Admin',
    firebaseUid: null,
    active: true,
    createdAt: date,
    updatedAt: date,
    userRoles: [{ roleId: 'role-admin' }],
    permissionOverrides: [],
  };
  const otherAdmin = { ...adminUser, id: 'u-admin2', email: 'b@test.com' };

  function build(users: unknown[]) {
    const prisma = {
      appUser: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: string } }) =>
            Promise.resolve(
              (users as { id: string }[]).find((u) => u.id === where.id) ??
                null,
            ),
          ),
        findMany: jest.fn().mockResolvedValue(users),
        delete: jest.fn().mockResolvedValue(undefined),
        update: jest.fn(),
      },
      appRole: {
        findMany: jest.fn().mockResolvedValue([adminRole]),
        findUnique: jest.fn().mockResolvedValue(adminRole),
        update: jest.fn(),
      },
      userRole: { deleteMany: jest.fn() },
      userPermissionOverride: { deleteMany: jest.fn() },
      rolePermission: { deleteMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UserAccessService(
      { isConfigured: () => true, prisma } as unknown as PrismaService,
      { syncDefaults: jest.fn() } as unknown as UserAccessBootstrapService,
    );
    return { service, prisma };
  }

  it('no deja borrar al último administrador', async () => {
    const { service, prisma } = build([adminUser]);
    await expect(service.removeUser('u-admin')).rejects.toThrow(
      'al menos un administrador',
    );
    expect(prisma.appUser.delete).not.toHaveBeenCalled();
  });

  it('permite borrar un administrador si queda otro', async () => {
    const { service, prisma } = build([adminUser, otherAdmin]);
    await service.removeUser('u-admin');
    expect(prisma.appUser.delete).toHaveBeenCalled();
  });

  it('no deja que un usuario se borre a sí mismo', async () => {
    const { service, prisma } = build([adminUser, otherAdmin]);
    await expect(service.removeUser('u-admin', 'u-admin')).rejects.toThrow(
      'tu propio usuario',
    );
    expect(prisma.appUser.delete).not.toHaveBeenCalled();
  });

  it('no deja desactivar ni quitarle el rol al último administrador', async () => {
    const { service, prisma } = build([adminUser]);
    await expect(
      service.updateUser('u-admin', { active: false }),
    ).rejects.toThrow('al menos un administrador');
    await expect(
      service.updateUser('u-admin', { roleIds: [] }),
    ).rejects.toThrow('al menos un administrador');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('un rol del sistema no puede perder permisos de administración', async () => {
    const { service, prisma } = build([adminUser, otherAdmin]);
    await expect(
      service.updateRole('role-admin', { permissions: [] }),
    ).rejects.toThrow('rol del sistema');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
