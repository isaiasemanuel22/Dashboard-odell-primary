import { ChatConversation, ChatMessage } from '../common/interfaces';

/** Salida de mensajes hacia el canal (WhatsApp, Instagram, Messenger). */
export interface ChannelGateway {
  send(payload: {
    conversation: ChatConversation;
    message: ChatMessage;
    /** Plantilla aprobada de WhatsApp (fuera de la ventana de 24 h). */
    template?: { name: string; language: string; params: string[] };
  }): Promise<{ externalMessageId?: string | null }>;
}

export const CHANNEL_GATEWAY = Symbol('CHANNEL_GATEWAY');
