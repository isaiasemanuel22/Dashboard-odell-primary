import { Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { assertAdmin } from '../auth/admin.util';
import { AppConfigService } from '../config/app-config.service';
import { AlertsNotifier } from './alerts-notifier';

@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly notifier: AlertsNotifier,
    private readonly config: AppConfigService,
  ) {}

  /** Manda un aviso de prueba por WhatsApp y por email. */
  @Post('test')
  async test(@Req() request: Request) {
    assertAdmin(request, this.config.requireAuth);
    const text = 'Aviso de prueba de Odell';
    await this.notifier.notifyOwnerWhatsApp(text);
    await this.notifier.notifyOwnerEmail(text, `<p>${text}</p>`, text);
    return { sent: true };
  }
}
