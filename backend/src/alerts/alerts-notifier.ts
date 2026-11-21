import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { EMAIL_SENDER, WHATSAPP_SENDER } from './notification-sender';
import type { NotificationSender } from './notification-sender';

/** Manda avisos a Isaías por WhatsApp o email (destinatarios por env). */
@Injectable()
export class AlertsNotifier {
  constructor(
    @Inject(WHATSAPP_SENDER) private readonly whatsapp: NotificationSender,
    @Inject(EMAIL_SENDER) private readonly email: NotificationSender,
    private readonly config: AppConfigService,
  ) {}

  notifyOwnerWhatsApp(text: string): Promise<void> {
    return this.whatsapp.send({
      to: this.config.alertsWhatsAppTo ?? '',
      text,
    });
  }

  notifyOwnerEmail(subject: string, html: string, text: string): Promise<void> {
    return this.email.send({
      to: this.config.alertsEmailTo ?? '',
      subject,
      html,
      text,
    });
  }
}
