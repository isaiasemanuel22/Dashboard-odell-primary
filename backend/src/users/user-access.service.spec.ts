import { ForbiddenException } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
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
