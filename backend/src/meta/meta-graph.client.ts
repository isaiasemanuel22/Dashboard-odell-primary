import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { GRAPH_API_URL } from './meta.constants';

export interface MetaTemplatePayload {
  name: string;
  language: string;
  params: string[];
}

export type WhatsAppOutgoing =
  | { type: 'text'; body: string }
  | { type: 'image' | 'document'; link: string; filename?: string }
  | { type: 'template'; template: MetaTemplatePayload };

export type PageOutgoing =
  | { text: string }
  | {
      attachment: {
        type: 'image' | 'audio' | 'video' | 'file';
        payload: { url: string };
      };
    };

export interface MetaTemplateStatus {
  name: string;
  status: string;
  language: string;
}

/** Cliente mínimo de la Graph API (WhatsApp Cloud API y Send API de páginas). */
@Injectable()
export class MetaGraphClient {
  constructor(private readonly config: AppConfigService) {}

  /** https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages */
  async sendWhatsApp(to: string, outgoing: WhatsAppOutgoing): Promise<string> {
    let content: Record<string, unknown>;
    if (outgoing.type === 'text') {
      content = { type: 'text', text: { body: outgoing.body } };
    } else if (outgoing.type === 'template') {
      const { template } = outgoing;
      content = {
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language },
          components: [
            {
              type: 'body',
              parameters: template.params.map((text) => ({
                type: 'text',
                text,
              })),
            },
          ],
        },
      };
    } else {
      content = {
        type: outgoing.type,
        [outgoing.type]: {
          link: outgoing.link,
          ...(outgoing.filename ? { filename: outgoing.filename } : {}),
        },
      };
    }
    const data = await this.request<{ messages?: Array<{ id: string }> }>(
      `/${this.config.whatsappPhoneNumberId}/messages`,
      this.config.metaAccessToken,
      { messaging_product: 'whatsapp', to, ...content },
    );
    return data.messages?.[0]?.id ?? '';
  }

  /** https://developers.facebook.com/docs/messenger-platform/reference/send-api */
  async sendPage(recipientId: string, message: PageOutgoing): Promise<string> {
    const data = await this.request<{ message_id?: string }>(
      `/${this.config.metaPageId}/messages`,
      this.config.metaPageAccessToken,
      { recipient: { id: recipientId }, messaging_type: 'RESPONSE', message },
    );
    return data.message_id ?? '';
  }

  async listTemplates(): Promise<MetaTemplateStatus[]> {
    const data = await this.request<{ data?: MetaTemplateStatus[] }>(
      `/${this.config.whatsappBusinessAccountId}/message_templates?fields=name,status,language`,
      this.config.metaAccessToken,
    );
    return data.data ?? [];
  }

  /** Número que se muestra para el WhatsApp conectado. */
  async phoneInfo(): Promise<{ displayPhoneNumber: string | null }> {
    const data = await this.request<{ display_phone_number?: string }>(
      `/${this.config.whatsappPhoneNumberId}?fields=display_phone_number`,
      this.config.metaAccessToken,
    );
    return { displayPhoneNumber: data.display_phone_number ?? null };
  }

  private async request<T>(
    path: string,
    token: string | undefined,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${GRAPH_API_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = (await response.json().catch(() => ({}))) as T & {
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(
        data.error?.message ?? `Meta respondió ${response.status}`,
      );
    }
    return data;
  }
}
