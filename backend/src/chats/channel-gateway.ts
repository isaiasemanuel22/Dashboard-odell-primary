import { ChatConversation, ChatMessage } from '../common/interfaces';

/** Salida de mensajes hacia el canal (WhatsApp, Instagram, Messenger). */
export interface ChannelGateway {
  send(payload: {
    conversation: ChatConversation;
    message: ChatMessage;
  }): Promise<{ externalMessageId?: string | null }>;
}

export const CHANNEL_GATEWAY = Symbol('CHANNEL_GATEWAY');
