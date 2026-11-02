import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CurrentUserProfile } from '../common/interfaces';
import { AppConfigService } from '../config/app-config.service';
import { UserAccessService } from '../users/user-access.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { IS_PUBLIC_KEY } from './public.decorator';

const NO_ACCESS_MESSAGE =
  'Tu cuenta no tiene acceso. Pedile al administrador que te dé de alta.';
const ACCESS_UNAVAILABLE_MESSAGE =
  'No se pudo verificar tu acceso. Probá de nuevo en un momento.';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly config: AppConfigService,
    private readonly userAccess: UserAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.firebaseAdmin.isEnabled()) {
      if (this.config.requireAuth) {
        throw new UnauthorizedException('Autenticación no configurada');
      }
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) {
      // En local (REQUIRE_AUTH=false) el login testing@test.com no envía Bearer.
      // Si Firebase está configurado igual dejamos pasar; con token sí se valida.
      if (!this.config.requireAuth) {
        return true;
      }
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    try {
      request.user = await this.firebaseAdmin.verifyIdToken(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    await this.attachAppUser(request);
    return true;
  }

  private async attachAppUser(request: Request): Promise<void> {
    try {
      const profile = await this.userAccess.resolveCurrentUser(request.user);
      if (!profile) {
        throw new ForbiddenException(NO_ACCESS_MESSAGE);
      }
      request.appUser = profile;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      // Fallo seguro: sin base de usuarios no se deja pasar (prod ni local con token).
      throw new ServiceUnavailableException(ACCESS_UNAVAILABLE_MESSAGE);
    }
  }

  private extractBearerToken(header?: string): string | null {
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length).trim();
    return token || null;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: import('firebase-admin/auth').DecodedIdToken;
    appUser?: CurrentUserProfile;
  }
}
