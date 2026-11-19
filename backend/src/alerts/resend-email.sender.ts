import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { NotificationMessage, NotificationSender } from './notification-sender';

const RESEND_URL = 'https://api.resend.com/emails';

/** Email por Resend (https://resend.com/docs/api-reference/emails/send-email). */
@Injectable()
export class ResendEmailSender implements NotificationSender {
  private readonly logger = new Logger(ResendEmailSender.name);

  constructor(private readonly config: AppConfigService) {}

  async send(message: NotificationMessage): Promise<void> {
    const apiKey = this.config.resendApiKey;
    const from = this.config.alertsEmailFrom;
    if (!apiKey || !from || !message.to) {
      this.logger.warn(
        `Email sin enviar (falta RESEND_API_KEY, ALERTS_EMAIL_FROM o ALERTS_EMAIL_TO): ${message.subject ?? ''}`,
      );
      return;
    }

    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Resend respondió ${response.status}: ${await response.text()}`,
      );
    }
  }
}
