import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import { AppConfigService } from '../config/app-config.service';
import { verifyMetaSignature } from './meta-signature.util';
import { MetaWebhookService } from './meta-webhook.service';
import type { MetaWebhookPayload } from './meta-webhook.parser';

/** Webhook de Meta (WhatsApp, Instagram y Messenger). Sin login: se valida la firma. */
@Public()
@Controller('meta/webhook')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly webhook: MetaWebhookService,
  ) {}

  /** Verificación al suscribir el webhook en el panel de Meta. */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    const expected = this.config.metaVerifyToken;
    if (mode !== 'subscribe' || !expected || token !== expected) {
      throw new ForbiddenException('Token de verificación inválido');
    }
    res.status(200).type('text/plain').send(challenge);
  }

  @Post()
  @HttpCode(200)
  receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: MetaWebhookPayload,
  ): { ok: true } {
    const secret = this.config.metaAppSecret;
    if (!secret) {
      if (this.config.isProduction) {
        throw new ServiceUnavailableException('Falta META_APP_SECRET');
      }
      this.logger.warn(
        'Webhook de Meta sin validar firma (falta META_APP_SECRET)',
      );
    } else if (!verifyMetaSignature(req.rawBody, signature, secret)) {
      throw new UnauthorizedException('Firma inválida');
    }
    this.webhook.handle(body);
    return { ok: true };
  }
}
