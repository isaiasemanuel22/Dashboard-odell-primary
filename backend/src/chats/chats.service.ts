import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApproveSuggestionDto,
  EditSuggestionDto,
  ListChatsQueryDto,
  SendChatMessageDto,
} from '../common/dto';
import {
  ChatAuthor,
  ChatChannel,
  ChatDirection,
  ChatMessageStatus,
  ChatStatus,
  QuoteStatus,
} from '../common/enums';
import {
  ChatConversation,
  ChatDetail,
  ChatMessage,
  ChatSummary,
  ProductAttachment,
} from '../common/interfaces';
import {
  ChatRepository,
  CustomerRepository,
  OrderRepository,
  QuoteRepository,
} from '../store/repositories';
import { StoreChangeService } from '../store/store-change.service';
import { CHANNEL_GATEWAY } from './channel-gateway';
import type { ChannelGateway } from './channel-gateway';
import { chatWindow, normalizeSearchText, onlyDigits } from './chats.util';

const WINDOW_CLOSED_MESSAGE =
  'Pasaron más de 24 h desde el último mensaje del cliente: por ahora solo se puede mandar una plantilla aprobada.';

const OPEN_QUOTE_STATUSES = [QuoteStatus.BORRADOR, QuoteStatus.ENVIADO];

export interface ChatsOverview {
  conversations: ChatSummary[];
  counts: {
    all: number;
    unread: number;
    pendingApproval: number;
    handedOff: number;
    byChannel: Record<ChatChannel, number>;
  };
}

export interface RegisterInboundInput {
  channel: ChatChannel;
  externalId: string;
  displayName?: string | null;
  displayPhone?: string | null;
  text: string;
  attachments?: ProductAttachment[];
  externalMessageId?: string | null;
  sentAt?: string;
}

@Injectable()
export class ChatsService {
  constructor(
    private readonly chats: ChatRepository,
    private readonly customers: CustomerRepository,
    private readonly orders: OrderRepository,
    private readonly quotes: QuoteRepository,
    private readonly storeChange: StoreChangeService,
    @Inject(CHANNEL_GATEWAY) private readonly gateway: ChannelGateway,
  ) {}

  list(query: ListChatsQueryDto = {}): ChatsOverview {
    const now = new Date();
    const byConversation = this.messagesByConversation();
    const term = normalizeSearchText(query.search);
    const termDigits = onlyDigits(query.search);
    const searched = this.chats
      .findAllConversations()
      .map((chat) =>
        this.summarize(chat, byConversation.get(chat.id) ?? [], now),
      )
      .filter((summary) => {
        if (!term) return true;
        if (
          normalizeSearchText(summary.contactName).includes(term) ||
          normalizeSearchText(summary.displayPhone).includes(term)
        ) {
          return true;
        }
        return (
          !!termDigits &&
          (onlyDigits(summary.externalId).includes(termDigits) ||
            onlyDigits(summary.displayPhone).includes(termDigits))
        );
      });

    const byChannel = { whatsapp: 0, instagram: 0, messenger: 0 };
    for (const summary of searched) byChannel[summary.channel] += 1;
    const counts = {
      all: searched.length,
      unread: searched.filter((s) => s.unreadCount > 0).length,
      pendingApproval: searched.filter(
        (s) => s.status === ChatStatus.PENDING_APPROVAL,
      ).length,
      handedOff: searched.filter((s) => s.status === ChatStatus.HANDED_OFF)
        .length,
      byChannel,
    };

    const conversations = searched
      .filter((s) => !query.channel || s.channel === query.channel)
      .filter((s) => {
        if (query.filter === 'unread') return s.unreadCount > 0;
        if (query.filter === 'pending_approval') {
          return s.status === ChatStatus.PENDING_APPROVAL;
        }
        if (query.filter === 'handed_off') {
          return s.status === ChatStatus.HANDED_OFF;
        }
        return true;
      })
      .sort((a, b) =>
        (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''),
      );
    return { conversations, counts };
  }

  unreadCount(): { unreadConversations: number } {
    const now = new Date();
    const byConversation = this.messagesByConversation();
    const unreadConversations = this.chats
      .findAllConversations()
      .filter(
        (chat) =>
          this.summarize(chat, byConversation.get(chat.id) ?? [], now)
            .unreadCount > 0,
      ).length;
    return { unreadConversations };
  }

  detail(id: string): ChatDetail {
    const chat = this.require(id);
    const messages = this.messagesOf(id);
    const conversation = this.summarize(chat, messages, new Date());

    const suggestionQuotes: ChatDetail['suggestionQuotes'] = {};
    for (const message of messages) {
      if (!message.quoteId || suggestionQuotes[message.quoteId]) continue;
      const quote = this.quotes.findById(message.quoteId);
      if (!quote) continue;
      suggestionQuotes[quote.id] = {
        id: quote.id,
        status: quote.status,
        total: quote.total,
        items: quote.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };
    }

    const customer = conversation.customerId
      ? (this.customers.findById(conversation.customerId) ?? null)
      : null;
    let customerContext: ChatDetail['customerContext'] = null;
    if (customer) {
      const lastOrder = this.orders
        .findAll()
        .filter((order) => order.customerId === customer.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      customerContext = {
        lastOrder: lastOrder
          ? {
              id: lastOrder.id,
              total: lastOrder.total,
              createdAt: lastOrder.createdAt,
            }
          : null,
        openQuotes: this.quotes
          .findAll()
          .filter(
            (quote) =>
              quote.customerId === customer.id &&
              OPEN_QUOTE_STATUSES.includes(quote.status),
          )
          .map((quote) => ({
            id: quote.id,
            status: quote.status,
            total: quote.total,
          })),
      };
    }

    return {
      conversation,
      messages,
      suggestionQuotes,
      customer,
      customerContext,
    };
  }

  async send(
    id: string,
    data: SendChatMessageDto,
    userId?: string,
  ): Promise<ChatMessage> {
    const chat = this.require(id);
    const sent = await this.sendOut(
      chat,
      data,
      ChatAuthor.HUMAN,
      userId ?? null,
    );
    // Si escribe un humano, el agente se calla en este chat hasta que lo reactiven.
    this.chats.saveConversation({
      ...chat,
      handedOff: false,
      agentPaused: true,
      updatedAt: sent.sentAt,
    });
    return sent;
  }

  /** Mensaje del agente automático: sale directo, sin aprobación. */
  async sendOutbound(
    conversationId: string,
    data: {
      text: string;
      attachments?: ProductAttachment[];
      author: ChatAuthor.AGENT;
    },
  ): Promise<ChatMessage> {
    const chat = this.require(conversationId);
    const sent = await this.sendOut(chat, data, data.author, null);
    this.recordChange('update', chat.id);
    return sent;
  }

  /** Plantilla aprobada de WhatsApp: sale aunque la ventana de 24 h esté cerrada. */
  async sendTemplate(
    conversationId: string,
    data: {
      text: string;
      template: { name: string; language: string; params: string[] };
    },
    userId?: string,
  ): Promise<ChatMessage> {
    const chat = this.require(conversationId);
    if (chat.channel !== ChatChannel.WHATSAPP) {
      throw new BadRequestException('Las plantillas son solo para WhatsApp');
    }
    const now = new Date().toISOString();
    const message = this.chats.createMessage({
      id: this.chats.nextMessageId(),
      conversationId: chat.id,
      direction: ChatDirection.OUT,
      author: ChatAuthor.HUMAN,
      authorUserId: userId ?? null,
      text: data.text,
      attachments: [],
      status: ChatMessageStatus.SENT,
      externalMessageId: null,
      quoteId: null,
      sentAt: now,
      updatedAt: now,
    });
    const sent = await this.deliver(chat, message, data.template);
    // Como en send: si escribe un humano, el agente se calla en este chat.
    this.chats.saveConversation({
      ...chat,
      agentPaused: true,
      updatedAt: sent.sentAt,
    });
    this.recordChange('update', chat.id);
    return sent;
  }

  /** Meta avisó que un mensaje saliente no llegó. */
  markDeliveryFailed(externalMessageId: string): ChatMessage | null {
    const message = this.chats
      .findAllMessages()
      .find((m) => m.externalMessageId === externalMessageId);
    if (!message || message.direction !== ChatDirection.OUT) return null;
    const saved = this.chats.saveMessage({
      ...message,
      status: ChatMessageStatus.FAILED,
      updatedAt: new Date().toISOString(),
    });
    this.recordChange('update', message.conversationId);
    return saved;
  }

  markRead(id: string): ChatSummary {
    const now = new Date().toISOString();
    const chat = this.chats.saveConversation({
      ...this.require(id),
      lastReadAt: now,
      updatedAt: now,
    });
    return this.summarize(chat, this.messagesOf(id), new Date());
  }

  linkCustomer(conversationId: string, customerId: string): ChatSummary {
    const chat = this.require(conversationId);
    if (!this.customers.findById(customerId)) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return this.updateCustomer(chat, customerId);
  }

  unlinkCustomer(id: string): ChatSummary {
    return this.updateCustomer(this.require(id), null);
  }

  editSuggestion(
    id: string,
    messageId: string,
    data: EditSuggestionDto,
  ): ChatMessage {
    const suggestion = this.requireSuggestion(id, messageId);
    const text = data.text?.trim() ?? '';
    if (!text)
      throw new BadRequestException('El mensaje no puede quedar vacío');
    return this.chats.saveMessage({
      ...suggestion,
      text,
      updatedAt: new Date().toISOString(),
    });
  }

  async approveSuggestion(
    id: string,
    messageId: string,
    data: ApproveSuggestionDto,
    userId?: string,
  ): Promise<ChatMessage> {
    const suggestion = this.requireSuggestion(id, messageId);
    const chat = this.require(id);
    this.assertWindowOpen(chat);
    const now = new Date().toISOString();
    const message = this.chats.saveMessage({
      ...suggestion,
      text: data.text?.trim() || suggestion.text,
      author: ChatAuthor.AGENT,
      authorUserId: userId ?? null,
      status: ChatMessageStatus.SENT,
      sentAt: now,
      updatedAt: now,
    });
    return this.deliver(chat, message);
  }

  discardSuggestion(id: string, messageId: string): ChatMessage {
    const suggestion = this.requireSuggestion(id, messageId);
    return this.chats.saveMessage({
      ...suggestion,
      status: ChatMessageStatus.DISCARDED,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Mensaje entrante desde un canal. Crea la conversación si no existe. */
  registerInbound(input: RegisterInboundInput): {
    conversation: ChatConversation;
    message: ChatMessage;
  } {
    const now = new Date().toISOString();
    const existing = this.chats.findConversationByExternalId(
      input.channel,
      input.externalId,
    );
    if (existing && input.externalMessageId) {
      const repeated = this.chats
        .findAllMessages()
        .find(
          (message) =>
            message.conversationId === existing.id &&
            message.externalMessageId === input.externalMessageId,
        );
      if (repeated) return { conversation: existing, message: repeated };
    }

    const conversation = existing
      ? this.chats.saveConversation({
          ...existing,
          displayName: input.displayName || existing.displayName,
          displayPhone: input.displayPhone || existing.displayPhone,
          updatedAt: now,
        })
      : this.chats.createConversation({
          id: this.chats.nextConversationId(),
          channel: input.channel,
          externalId: input.externalId,
          displayName: input.displayName || null,
          displayPhone: input.displayPhone || null,
          customerId: null,
          handedOff: false,
          agentPaused: false,
          lastReadAt: null,
          createdAt: now,
          updatedAt: now,
        });
    const message = this.chats.createMessage({
      id: this.chats.nextMessageId(),
      conversationId: conversation.id,
      direction: ChatDirection.IN,
      author: ChatAuthor.CUSTOMER,
      authorUserId: null,
      text: input.text,
      attachments: input.attachments ?? [],
      status: ChatMessageStatus.RECEIVED,
      externalMessageId: input.externalMessageId ?? null,
      quoteId: null,
      sentAt: input.sentAt ?? now,
      updatedAt: now,
    });
    this.recordChange(existing ? 'update' : 'create', conversation.id);
    return { conversation, message };
  }

  /** Respuesta propuesta por el agente; queda para aprobar. */
  createSuggestion(
    conversationId: string,
    data: { text: string; quoteId?: string | null },
  ): ChatMessage {
    const chat = this.require(conversationId);
    const now = new Date().toISOString();
    const message = this.chats.createMessage({
      id: this.chats.nextMessageId(),
      conversationId: chat.id,
      direction: ChatDirection.OUT,
      author: ChatAuthor.AGENT,
      authorUserId: null,
      text: data.text,
      attachments: [],
      status: ChatMessageStatus.SUGGESTED,
      externalMessageId: null,
      quoteId: data.quoteId ?? null,
      sentAt: now,
      updatedAt: now,
    });
    this.recordChange('update', chat.id);
    return message;
  }

  setHandedOff(conversationId: string, value: boolean): ChatConversation {
    const chat = this.chats.saveConversation({
      ...this.require(conversationId),
      handedOff: value,
      ...(value ? { agentPaused: true } : {}),
      updatedAt: new Date().toISOString(),
    });
    this.recordChange('update', chat.id);
    return chat;
  }

  /** Reactivar también saca «Te derivó» (§28.3). */
  setAgentPaused(conversationId: string, value: boolean): ChatConversation {
    const chat = this.chats.saveConversation({
      ...this.require(conversationId),
      agentPaused: value,
      ...(value ? {} : { handedOff: false }),
      updatedAt: new Date().toISOString(),
    });
    this.recordChange('update', chat.id);
    return chat;
  }

  /** Valida, crea el mensaje saliente y lo manda por el canal. */
  private async sendOut(
    chat: ChatConversation,
    data: { text: string; attachments?: ProductAttachment[] },
    author: ChatAuthor,
    authorUserId: string | null,
  ): Promise<ChatMessage> {
    const text = data.text?.trim() ?? '';
    const attachments = data.attachments ?? [];
    if (!text && !attachments.length) {
      throw new BadRequestException('Escribí un mensaje o adjuntá un archivo');
    }
    this.assertWindowOpen(chat);
    const now = new Date().toISOString();
    const message = this.chats.createMessage({
      id: this.chats.nextMessageId(),
      conversationId: chat.id,
      direction: ChatDirection.OUT,
      author,
      authorUserId,
      text,
      attachments,
      status: ChatMessageStatus.SENT,
      externalMessageId: null,
      quoteId: null,
      sentAt: now,
      updatedAt: now,
    });
    return this.deliver(chat, message);
  }

  private async deliver(
    chat: ChatConversation,
    message: ChatMessage,
    template?: { name: string; language: string; params: string[] },
  ): Promise<ChatMessage> {
    try {
      const result = await this.gateway.send({
        conversation: chat,
        message,
        template,
      });
      return this.chats.saveMessage({
        ...message,
        status: ChatMessageStatus.SENT,
        externalMessageId: result.externalMessageId ?? null,
      });
    } catch {
      this.chats.saveMessage({
        ...message,
        status: ChatMessageStatus.FAILED,
        updatedAt: new Date().toISOString(),
      });
      // La respuesta es un error: el interceptor no guarda, se guarda acá.
      this.recordChange('update', chat.id);
      throw new BadGatewayException('No se pudo enviar el mensaje');
    }
  }

  private updateCustomer(
    chat: ChatConversation,
    customerId: string | null,
  ): ChatSummary {
    const saved = this.chats.saveConversation({
      ...chat,
      customerId,
      updatedAt: new Date().toISOString(),
    });
    return this.summarize(saved, this.messagesOf(saved.id), new Date());
  }

  private summarize(
    chat: ChatConversation,
    messages: ChatMessage[],
    now: Date,
  ): ChatSummary {
    const customer = chat.customerId
      ? this.customers.findById(chat.customerId)
      : undefined;
    const inbound = messages.filter((m) => m.direction === ChatDirection.IN);
    const lastInboundAt = inbound.length
      ? inbound[inbound.length - 1].sentAt
      : null;
    // Las sugerencias no salieron: no cuentan como último mensaje.
    const visible = messages.filter(
      (m) => m.status !== ChatMessageStatus.SUGGESTED,
    );
    const last = visible.length ? visible[visible.length - 1] : null;
    const pendingSuggestions = messages.filter(
      (m) => m.status === ChatMessageStatus.SUGGESTED,
    ).length;
    const window = chatWindow(lastInboundAt, now);
    let status = ChatStatus.OPEN;
    if (chat.handedOff) status = ChatStatus.HANDED_OFF;
    else if (pendingSuggestions) status = ChatStatus.PENDING_APPROVAL;

    return {
      id: chat.id,
      channel: chat.channel,
      externalId: chat.externalId,
      displayName: chat.displayName,
      displayPhone: chat.displayPhone,
      contactName: customer?.name ?? chat.displayName ?? null,
      customerId: customer ? customer.id : null,
      status,
      agentPaused: chat.agentPaused,
      unreadCount: inbound.filter(
        (m) => !chat.lastReadAt || m.sentAt > chat.lastReadAt,
      ).length,
      pendingSuggestions,
      lastMessageAt: last?.sentAt ?? null,
      lastMessagePreview: last
        ? last.text || (last.attachments.length ? 'Adjunto' : '')
        : null,
      lastMessageDirection: last?.direction ?? null,
      lastInboundAt,
      windowOpen: window.open,
      windowExpiresAt: window.expiresAt,
    };
  }

  /** Mensajes de la conversación, sin descartados y en orden de envío. */
  private messagesOf(id: string): ChatMessage[] {
    return this.messagesByConversation().get(id) ?? [];
  }

  private messagesByConversation(): Map<string, ChatMessage[]> {
    const map = new Map<string, ChatMessage[]>();
    for (const message of this.chats.findAllMessages()) {
      if (message.status === ChatMessageStatus.DISCARDED) continue;
      const list = map.get(message.conversationId) ?? [];
      list.push(message);
      map.set(message.conversationId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    }
    return map;
  }

  private require(id: string): ChatConversation {
    const chat = this.chats.findConversationById(id);
    if (!chat) throw new NotFoundException('Conversación no encontrada');
    return chat;
  }

  private requireSuggestion(id: string, messageId: string): ChatMessage {
    this.require(id);
    const message = this.chats.findMessageById(messageId);
    if (!message || message.conversationId !== id) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    if (message.status !== ChatMessageStatus.SUGGESTED) {
      throw new ConflictException('El mensaje ya no está para aprobar');
    }
    return message;
  }

  private assertWindowOpen(chat: ChatConversation): void {
    const lastInboundAt =
      this.messagesOf(chat.id)
        .filter((m) => m.direction === ChatDirection.IN)
        .pop()?.sentAt ?? null;
    if (!chatWindow(lastInboundAt, new Date()).open) {
      throw new ConflictException(WINDOW_CLOSED_MESSAGE);
    }
  }

  private recordChange(action: 'create' | 'update', id: string): void {
    this.storeChange.recordChange({
      collections: ['chatConversations', 'chatMessages'],
      realtime: { scopes: ['chats'], action, entity: 'chat', id },
    });
  }
}
