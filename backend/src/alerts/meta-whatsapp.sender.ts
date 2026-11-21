import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MetaGraphClient } from '../meta/meta-graph.client';
import { META_TEMPLATE_LANGUAGE, META_TEMPLATES } from '../meta/meta.constants';
import { NotificationMessage, NotificationSender } from './notification-sender';

const MAX_PARAM_LENGTH = 1000;

/** Meta no acepta saltos de línea, tabs ni más de 4 espacios seguidos en un parámetro. */
export function flattenTemplateParam(text: string): string {
  return text
    .replace(/\n• /g, ' • ')
    .replace(/\n+/g, ' · ')
    .replace(/\t/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim()
    .slice(0, MAX_PARAM_LENGTH);
}

/** Avisos a Isaías por WhatsApp: siempre con la plantilla aviso_odell (no depende de la ventana de 24 h). */
@Injectable()
export class MetaWhatsAppSender implements NotificationSender {
  private readonly logger = new Logger('WhatsApp');

  constructor(
    private readonly config: AppConfigService,
    private readonly graph: MetaGraphClient,
  ) {}

  async send(message: NotificationMessage): Promise<void> {
    if (!message.to || !this.config.whatsappConfigured) {
      this.logger.log(
        `[WhatsApp sin enviar → ${message.to || 'sin ALERTS_WHATSAPP_TO'}] ${message.text}`,
      );
      return;
    }
    const template = META_TEMPLATES.aviso_odell;
    await this.graph.sendWhatsApp(message.to.replace(/\D/g, ''), {
      type: 'template',
      template: {
        name: template.name,
        language: META_TEMPLATE_LANGUAGE,
        params: [flattenTemplateParam(message.text)],
      },
    });
  }
}
