import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { formatMoney } from '../alerts/alerts.util';
import { ChatsService } from '../chats/chats.service';
import { SendTemplateDto, TemplateTargetDto } from '../common/dto';
import { ChatChannel } from '../common/enums';
import {
  ChatConversation,
  ChatMessage,
  Order,
  Quote,
} from '../common/interfaces';
import { outstandingCents } from '../common/utils/money.util';
import { OrdersService } from '../orders/orders.service';
import { QuotesService } from '../quotes/quotes.service';
import { ChatRepository, CustomerRepository } from '../store/repositories';
import {
  CUSTOMER_TEMPLATE_KEYS,
  CustomerTemplateKey,
  META_TEMPLATE_LANGUAGE,
  META_TEMPLATES,
  renderTemplateBody,
} from './meta.constants';

export interface TemplatePreview {
  key: CustomerTemplateKey;
  label: string;
  /** Texto como le llega al cliente; null solo si faltan datos (pedido/presupuesto). */
  text: string | null;
  /** Por qué no se pudo armar el texto. */
  error: string | null;
  /** Hay chat de WhatsApp al que mandarlo (la conexión la valida el envío). */
  canSend: boolean;
  blockedReason: string | null;
}

interface ResolvedTarget {
  conversation: ChatConversation | null;
  order: Order | null;
  quote: Quote | null;
}

interface SendTarget extends ResolvedTarget {
  conversation: ChatConversation;
}

/** Plantillas de WhatsApp para clientes (§28.2): las manda Isaías con un botón. */
@Injectable()
export class MetaTemplatesService {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly chats: ChatRepository,
    private readonly customers: CustomerRepository,
    private readonly orders: OrdersService,
    private readonly quotes: QuotesService,
  ) {}

  async sendTemplate(
    data: SendTemplateDto,
    userId?: string,
  ): Promise<ChatMessage> {
    const target = this.resolve(data);
    const template = META_TEMPLATES[data.templateKey];
    const params = this.params(data.templateKey, target);
    return this.chatsService.sendTemplate(
      target.conversation.id,
      {
        text: renderTemplateBody(template.body, params),
        template: {
          name: template.name,
          language: META_TEMPLATE_LANGUAGE,
          params,
        },
      },
      userId,
    );
  }

  /**
   * Las 4 plantillas armadas con los datos del pedido o presupuesto. El texto
   * no depende del chat ni de la conexión: si falta el chat, `canSend` es
   * false y `blockedReason` dice por qué (el envío sigue validando igual).
   */
  preview(data: TemplateTargetDto): TemplatePreview[] {
    const order = data.orderId ? this.orders.findOne(data.orderId) : null;
    const quote = data.quoteId ? this.quotes.findOne(data.quoteId) : null;
    let conversation: ChatConversation | null = null;
    let blockedReason: string | null = null;
    try {
      conversation = this.findConversation(data, order, quote);
    } catch (error) {
      if (
        !(error instanceof BadRequestException) &&
        !(error instanceof NotFoundException)
      ) {
        throw error;
      }
      blockedReason = error.message;
    }
    return CUSTOMER_TEMPLATE_KEYS.map((key) => {
      const template = META_TEMPLATES[key];
      try {
        const params = this.params(key, { conversation, order, quote });
        return {
          key,
          label: template.label,
          text: renderTemplateBody(template.body, params),
          error: null,
          canSend: !!conversation,
          blockedReason,
        };
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
        return {
          key,
          label: template.label,
          text: null,
          error: error.message,
          canSend: false,
          blockedReason: error.message,
        };
      }
    });
  }

  private resolve(data: TemplateTargetDto): SendTarget {
    const order = data.orderId ? this.orders.findOne(data.orderId) : null;
    const quote = data.quoteId ? this.quotes.findOne(data.quoteId) : null;
    const conversation = this.findConversation(data, order, quote);
    return { conversation, order, quote };
  }

  private findConversation(
    data: TemplateTargetDto,
    order: Order | null,
    quote: Quote | null,
  ): ChatConversation {
    if (data.conversationId) {
      const conversation = this.chats.findConversationById(data.conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversación no encontrada');
      }
      if (conversation.channel !== ChatChannel.WHATSAPP) {
        throw new BadRequestException('Las plantillas son solo para WhatsApp');
      }
      return conversation;
    }
    const customerId = order?.customerId ?? quote?.customerId;
    const conversation = customerId
      ? this.chats
          .findAllConversations()
          .filter(
            (chat) =>
              chat.customerId === customerId &&
              chat.channel === ChatChannel.WHATSAPP,
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      : undefined;
    if (!conversation) {
      throw new BadRequestException('El cliente no tiene chat de WhatsApp');
    }
    return conversation;
  }

  private params(key: CustomerTemplateKey, target: ResolvedTarget): string[] {
    const template = META_TEMPLATES[key];
    const { conversation, order, quote } = target;
    const source = template.source === 'quote' ? quote : order;
    if (!source) {
      throw new BadRequestException(
        template.source === 'quote'
          ? 'Esta plantilla necesita un presupuesto'
          : 'Esta plantilla necesita un pedido',
      );
    }
    const customerId = conversation?.customerId ?? source.customerId;
    const name =
      (customerId ? this.customers.findById(customerId)?.name : undefined) ??
      conversation?.displayName ??
      source.customerName;
    const amount =
      template.source === 'quote'
        ? formatMoney(source.total)
        : formatMoney(outstandingCents(source) / 100);
    return template.params({ name, reference: source.id, amount });
  }
}
