import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUserProfile } from '../common/interfaces';
import { assertAdmin } from './admin.util';

describe('assertAdmin', () => {
  const user = { uid: 'firebase-1' } as Request['user'];

  it('admin logueado pasa', () => {
    expect(() =>
      assertAdmin(
        { user, appUser: { isAdmin: true } as CurrentUserProfile },
        true,
      ),
    ).not.toThrow();
  });

  it('usuario no admin → 403', () => {
    expect(() =>
      assertAdmin(
        { user, appUser: { isAdmin: false } as CurrentUserProfile },
        true,
      ),
    ).toThrow(ForbiddenException);
  });

  it('una llave de agente nunca pasa, ni en local', () => {
    expect(() =>
      assertAdmin(
        { apiKey: { id: 'key-1', name: 'Bot', scopes: ['catalogo:leer'] } },
        false,
      ),
    ).toThrow(ForbiddenException);
  });

  it('en local sin login (REQUIRE_AUTH=false) pasa', () => {
    expect(() => assertAdmin({}, false)).not.toThrow();
  });

  it('sin login con REQUIRE_AUTH=true → 403', () => {
    expect(() => assertAdmin({}, true)).toThrow(ForbiddenException);
  });
});
