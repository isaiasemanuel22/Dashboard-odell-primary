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
  /** Texto como le llega al cliente; null si no se puede mandar. */
  text: string | null;
  error: string | null;
}

interface ResolvedTarget {
  conversation: ChatConversation;
  order: Order | null;
  quote: Quote | null;
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

  /** Las 4 plantillas armadas para el destino, o por qué no se pueden mandar. */
  preview(data: TemplateTargetDto): TemplatePreview[] {
    let target: ResolvedTarget | null = null;
    let targetError: string | null = null;
    try {
      target = this.resolve(data);
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      targetError = error.message;
    }
    return CUSTOMER_TEMPLATE_KEYS.map((key) => {
      const template = META_TEMPLATES[key];
      if (!target) {
        return { key, label: template.label, text: null, error: targetError };
      }
      try {
        const params = this.params(key, target);
        return {
          key,
          label: template.label,
          text: renderTemplateBody(template.body, params),
          error: null,
        };
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
        return { key, label: template.label, text: null, error: error.message };
      }
    });
  }

  private resolve(data: TemplateTargetDto): ResolvedTarget {
    const order = data.orderId ? this.orders.findOne(data.orderId) : null;
    const quote = data.quoteId ? this.quotes.findOne(data.quoteId) : null;
    if (data.conversationId) {
      const conversation = this.chats.findConversationById(data.conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversación no encontrada');
      }
      if (conversation.channel !== ChatChannel.WHATSAPP) {
        throw new BadRequestException('Las plantillas son solo para WhatsApp');
      }
      return { conversation, order, quote };
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
    return { conversation, order, quote };
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
    const customerId = conversation.customerId ?? source.customerId;
    const name =
      (customerId ? this.customers.findById(customerId)?.name : undefined) ??
      conversation.displayName ??
      source.customerName;
    const amount =
      template.source === 'quote'
        ? formatMoney(source.total)
        : formatMoney(outstandingCents(source) / 100);
    return template.params({ name, reference: source.id, amount });
  }
}
