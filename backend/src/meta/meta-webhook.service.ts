import { Injectable, Logger } from '@nestjs/common';
import { ChatsService } from '../chats/chats.service';
import { MetaInboundEvents } from './meta-inbound.events';
import { parseMetaWebhook } from './meta-webhook.parser';
import type { MetaWebhookPayload } from './meta-webhook.parser';

/** Guarda en Chats lo que llega por el webhook. Nunca tira: Meta reintenta si no recibe 200. */
@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(
    private readonly chats: ChatsService,
    private readonly events: MetaInboundEvents,
  ) {}

  handle(payload: MetaWebhookPayload): void {
    try {
      const { inbound, failedStatusIds } = parseMetaWebhook(payload);
      for (const input of inbound) {
        const { conversation, message } = this.chats.registerInbound(input);
        this.events.inbound$.next({
          conversationId: conversation.id,
          messageId: message.id,
          channel: conversation.channel,
          externalId: conversation.externalId,
        });
      }
      for (const id of failedStatusIds) this.chats.markDeliveryFailed(id);
    } catch (error) {
      this.logger.error(
        `Webhook de Meta sin procesar: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
