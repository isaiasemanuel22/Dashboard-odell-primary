jest.mock('./firebase-admin.service', () => ({
  FirebaseAdminService: class FirebaseAdminService {},
}));

jest.mock('../users/user-access.service', () => ({
  UserAccessService: class UserAccessService {},
}));

import {
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CurrentUserProfile } from '../common/interfaces';
import { AppConfigService } from '../config/app-config.service';
import { UserAccessService } from '../users/user-access.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

describe('FirebaseAuthGuard', () => {
  const token = {
    uid: 'firebase-1',
    email: 'a@test.com',
  };
  const activeProfile = {
    id: 'user-1',
    email: 'a@test.com',
    displayName: 'Ana',
    active: true,
    roleIds: [],
    permissionOverrides: [],
    createdAt: '',
    updatedAt: '',
    roles: [],
    permissions: [],
    isAdmin: false,
  } as CurrentUserProfile;

  let reflector: { getAllAndOverride: jest.Mock };
  let firebaseAdmin: {
    isEnabled: jest.Mock;
    verifyIdToken: jest.Mock;
  };
  let config: {
    requireAuth: boolean;
    isProduction: boolean;
  };
  let userAccess: { resolveCurrentUser: jest.Mock };
  let guard: FirebaseAuthGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };
    firebaseAdmin = {
      isEnabled: jest.fn().mockReturnValue(true),
      verifyIdToken: jest.fn().mockResolvedValue(token),
    };
    config = {
      requireAuth: true,
      isProduction: false,
    };
    userAccess = {
      resolveCurrentUser: jest.fn(),
    };
    guard = new FirebaseAuthGuard(
      reflector as unknown as Reflector,
      firebaseAdmin as unknown as FirebaseAdminService,
      config as unknown as AppConfigService,
      userAccess as unknown as UserAccessService,
    );
  });

  function createContext(options?: {
    authorization?: string;
    isPublic?: boolean;
  }): { context: ExecutionContext; request: Record<string, unknown> } {
    reflector.getAllAndOverride.mockImplementation((key: unknown) => {
      if (key === IS_PUBLIC_KEY) return options?.isPublic ?? false;
      return false;
    });

    const request: Record<string, unknown> = {
      headers: {
        authorization: options?.authorization,
      },
    };

    const context = {
      getType: () => 'http',
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  it('token válido sin alta → 403', async () => {
    userAccess.resolveCurrentUser.mockResolvedValue(null);
    const { context } = createContext({
      authorization: 'Bearer valid-token',
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Tu cuenta no tiene acceso. Pedile al administrador que te dé de alta.',
    );
  });

  it('usuario inactivo → 403', async () => {
    userAccess.resolveCurrentUser.mockRejectedValue(
      new ForbiddenException('Tu usuario está desactivado'),
    );
    const { context } = createContext({
      authorization: 'Bearer valid-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Tu usuario está desactivado',
    );
  });

  it('usuario activo → pasa y deja el perfil en request', async () => {
    userAccess.resolveCurrentUser.mockResolvedValue(activeProfile);
    const { context, request } = createContext({
      authorization: 'Bearer valid-token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(token);
    expect(request.appUser).toBe(activeProfile);
  });

  it('@Public pasa sin exigir token', async () => {
    const { context } = createContext({ isPublic: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(firebaseAdmin.verifyIdToken).not.toHaveBeenCalled();
  });

  it('sin token con REQUIRE_AUTH=false pasa', async () => {
    config.requireAuth = false;
    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(userAccess.resolveCurrentUser).not.toHaveBeenCalled();
  });

  it('base no disponible con REQUIRE_AUTH=true → 503', async () => {
    userAccess.resolveCurrentUser.mockRejectedValue(
      new ServiceUnavailableException(
        'Usuarios y permisos requieren DATABASE_URL configurada',
      ),
    );
    const { context } = createContext({
      authorization: 'Bearer valid-token',
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'No se pudo verificar tu acceso. Probá de nuevo en un momento.',
    );
  });

  it('token inválido → 401', async () => {
    firebaseAdmin.verifyIdToken.mockRejectedValue(new Error('bad token'));
    const { context } = createContext({
      authorization: 'Bearer bad',
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
