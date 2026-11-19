export interface NotificationMessage {
  to: string;
  subject?: string;
  text: string;
  html?: string;
}

/** Canal de salida de un aviso (WhatsApp, email). */
export interface NotificationSender {
  send(message: NotificationMessage): Promise<void>;
}

export const WHATSAPP_SENDER = Symbol('WHATSAPP_SENDER');
export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
