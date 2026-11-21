import { Injectable, Logger } from '@nestjs/common';
import { NotificationMessage, NotificationSender } from './notification-sender';

/** Hasta conectar Meta (§28.1), el WhatsApp queda en el log del servidor. */
@Injectable()
export class LogWhatsAppSender implements NotificationSender {
  private readonly logger = new Logger('WhatsApp');

  send(message: NotificationMessage): Promise<void> {
    this.logger.log(
      `[WhatsApp → ${message.to || 'sin ALERTS_WHATSAPP_TO'}] ${message.text}`,
    );
    return Promise.resolve();
  }
}
