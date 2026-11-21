import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Solo un administrador logueado. Las llaves de agente nunca pasan.
 * En local sin Bearer (REQUIRE_AUTH=false) se trata como admin.
 */
export function assertAdmin(
  request: Pick<Request, 'user' | 'appUser' | 'apiKey'>,
  requireAuth: boolean,
): void {
  if (request.apiKey) {
    throw new ForbiddenException('Una llave de agente no puede hacer esto');
  }
  if (request.appUser?.isAdmin) return;
  if (!request.user && !requireAuth) return;
  throw new ForbiddenException(
    'Solo un administrador puede manejar las llaves de acceso',
  );
}
