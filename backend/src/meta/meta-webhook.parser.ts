import type { RegisterInboundInput } from '../chats/chats.service';
import { ChatChannel } from '../common/enums';
import { ProductAttachment } from '../common/interfaces';

/* Formato de los webhooks (solo los campos que se leen):
 * WhatsApp: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 * Messenger / Instagram: https://developers.facebook.com/docs/messenger-platform/webhooks */

interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
}

interface WhatsAppValue {
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
  messages?: WhatsAppMessage[];
  statuses?: Array<{ id: string; status: string }>;
}

interface PageMessagingEvent {
  sender?: { id: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: Array<{ type?: string; payload?: { url?: string } }>;
  };
}

export interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{ field?: string; value?: WhatsAppValue }>;
    messaging?: PageMessagingEvent[];
  }>;
}

export interface ParsedMetaWebhook {
  inbound: RegisterInboundInput[];
  failedStatusIds: string[];
}

const MEDIA_LABELS: Record<string, string> = {
  image: '[Imagen]',
  audio: '[Audio]',
  video: '[Video]',
  document: '[Documento]',
  sticker: '[Sticker]',
  file: '[Archivo]',
};

const MEDIA_MIME_TYPES: Record<string, string> = {
  image: 'image/jpeg',
  audio: 'audio/mpeg',
  video: 'video/mp4',
  file: 'application/octet-stream',
};

export function parseMetaWebhook(
  payload: MetaWebhookPayload,
): ParsedMetaWebhook {
  const result: ParsedMetaWebhook = { inbound: [], failedStatusIds: [] };
  if (payload.object === 'whatsapp_business_account') {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages' || !change.value) continue;
        parseWhatsAppValue(change.value, result);
      }
    }
  } else if (payload.object === 'page' || payload.object === 'instagram') {
    const channel =
      payload.object === 'page' ? ChatChannel.MESSENGER : ChatChannel.INSTAGRAM;
    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        const input = parsePageEvent(channel, event);
        if (input) result.inbound.push(input);
      }
    }
  }
  return result;
}

function parseWhatsAppValue(
  value: WhatsAppValue,
  result: ParsedMetaWebhook,
): void {
  for (const message of value.messages ?? []) {
    const contact = value.contacts?.find((c) => c.wa_id === message.from);
    result.inbound.push({
      channel: ChatChannel.WHATSAPP,
      externalId: message.from,
      displayName: contact?.profile?.name ?? null,
      displayPhone: `+${message.from}`,
      text: whatsAppText(message),
      externalMessageId: message.id,
      sentAt: toIso(Number(message.timestamp) * 1000),
    });
  }
  for (const status of value.statuses ?? []) {
    if (status.status === 'failed') result.failedStatusIds.push(status.id);
  }
}

function whatsAppText(message: WhatsAppMessage): string {
  if (message.text?.body) return message.text.body;
  if (message.button?.text) return message.button.text;
  const reply =
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title;
  if (reply) return reply;
  const label = MEDIA_LABELS[message.type ?? ''];
  if (!label) return '';
  const caption =
    message.image?.caption ??
    message.video?.caption ??
    message.document?.caption ??
    message.document?.filename;
  return caption ? `${label} ${caption}` : label;
}

function parsePageEvent(
  channel: ChatChannel,
  event: PageMessagingEvent,
): RegisterInboundInput | null {
  // Lectura, entrega y reacciones llegan sin message; el eco es lo que mandamos nosotros.
  const message = event.message;
  if (!message || message.is_echo || !event.sender?.id) return null;
  const attachments: ProductAttachment[] = (message.attachments ?? [])
    .filter((a) => a.payload?.url)
    .map((a, index) => {
      const type = a.type ?? 'file';
      return {
        id: `${message.mid ?? 'att'}-${index}`,
        name: (MEDIA_LABELS[type] ?? '[Archivo]').slice(1, -1),
        url: a.payload!.url!,
        mimeType: MEDIA_MIME_TYPES[type] ?? 'application/octet-stream',
        size: 0,
      };
    });
  if (!message.text && !attachments.length) return null;
  return {
    channel,
    externalId: event.sender.id,
    text: message.text ?? '',
    attachments,
    externalMessageId: message.mid ?? null,
    sentAt: toIso(event.timestamp),
  };
}

function toIso(ms: number | undefined): string | undefined {
  return ms && Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}
