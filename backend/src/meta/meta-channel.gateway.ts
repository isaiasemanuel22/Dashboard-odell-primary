import type { ChannelGateway } from '../chats/channel-gateway';
import { ChatChannel } from '../common/enums';
import { ProductAttachment } from '../common/interfaces';
import { AppConfigService } from '../config/app-config.service';
import { MetaGraphClient } from './meta-graph.client';
import type { PageOutgoing } from './meta-graph.client';

type ChannelPayload = Parameters<ChannelGateway['send']>[0];

const isPublicUrl = (url: string) => /^https?:\/\//i.test(url);

/** Manda los mensajes de Chats por Meta. Sin credenciales del canal, no sale a la red. */
export class MetaChannelGateway implements ChannelGateway {
  constructor(
    private readonly graph: MetaGraphClient,
    private readonly config: AppConfigService,
  ) {}

  async send(
    payload: ChannelPayload,
  ): Promise<{ externalMessageId: string | null }> {
    const { conversation } = payload;
    const configured =
      conversation.channel === ChatChannel.WHATSAPP
        ? this.config.whatsappConfigured
        : this.config.pageConfigured;
    if (!configured) {
      return { externalMessageId: null };
    }
    const ids =
      conversation.channel === ChatChannel.WHATSAPP
        ? await this.sendWhatsApp(payload)
        : await this.sendPage(payload);
    return { externalMessageId: ids.find(Boolean) ?? null };
  }

  private async sendWhatsApp({
    conversation,
    message,
    template,
  }: ChannelPayload): Promise<string[]> {
    const to = conversation.externalId;
    if (template) {
      return [
        await this.graph.sendWhatsApp(to, { type: 'template', template }),
      ];
    }
    const ids: string[] = [];
    if (message.text) {
      ids.push(
        await this.graph.sendWhatsApp(to, { type: 'text', body: message.text }),
      );
    }
    for (const attachment of publicAttachments(message.attachments)) {
      const image = attachment.mimeType.startsWith('image/');
      ids.push(
        await this.graph.sendWhatsApp(to, {
          type: image ? 'image' : 'document',
          link: attachment.url,
          ...(image ? {} : { filename: attachment.name }),
        }),
      );
    }
    return ids;
  }

  private async sendPage({
    conversation,
    message,
  }: ChannelPayload): Promise<string[]> {
    const outgoing: PageOutgoing[] = [];
    if (message.text) outgoing.push({ text: message.text });
    for (const attachment of publicAttachments(message.attachments)) {
      outgoing.push({
        attachment: {
          type: pageAttachmentType(attachment.mimeType),
          payload: { url: attachment.url },
        },
      });
    }
    const ids: string[] = [];
    for (const item of outgoing) {
      ids.push(await this.graph.sendPage(conversation.externalId, item));
    }
    return ids;
  }
}

function publicAttachments(attachments: ProductAttachment[]) {
  return attachments.filter((attachment) => isPublicUrl(attachment.url));
}

function pageAttachmentType(
  mimeType: string,
): 'image' | 'audio' | 'video' | 'file' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
}
