import type Anthropic from '@anthropic-ai/sdk';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AlertsNotifier } from '../alerts/alerts-notifier';
import { formatMoney } from '../alerts/alerts.util';
import { onlyDigits } from '../chats/chats.util';
import { ChatsService } from '../chats/chats.service';
import {
  ChatAuthor,
  ChatChannel,
  CustomerSource,
  CustomerType,
  QuoteStatus,
  SalesChannel,
  ServiceType,
  TaskType,
} from '../common/enums';
import {
  AttendantSettings,
  ChatConversation,
  Customer,
  Product,
} from '../common/interfaces';
import { arTodayKey } from '../common/utils/ar-date.util';
import { CustomersService } from '../customers/customers.service';
import { catalogLine, findPublishedProduct } from '../mcp/catalog-line.util';
import { McpToolsService } from '../mcp/mcp-tools.service';
import { estimateTaskHours } from '../print-jobs/order-task-estimate';
import { PrinterQueueService } from '../print-jobs/printer-queue.service';
import { buildProductStockOverview } from '../products/product-stock.util';
import { QuotesService } from '../quotes/quotes.service';
import { ChatRepository } from '../store/repositories';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import {
  addCalendarDaysToKey,
  businessDaysToCalendarDays,
} from '../supplies/business-days.util';
import { AgentToolSummary } from './attendant-usage.service';

export const CHANNEL_LABELS: Record<ChatChannel, string> = {
  [ChatChannel.WHATSAPP]: 'WhatsApp',
  [ChatChannel.INSTAGRAM]: 'Instagram',
  [ChatChannel.MESSENGER]: 'Messenger',
};

export const HANDOFF_MESSAGE = 'Lo consulto y te respondo en un rato';
const AGENT_QUOTE_DESCRIPTION = 'Creado por el agente desde Chats';
/** Más horas que esto no las calcula la cola (deliveryEstimate las recorta). */
const MAX_QUEUE_HOURS = 200;

/** Herramientas que cierran la vuelta: después no se llama más al modelo. */
export const FINAL_TOOLS = ['responder', 'derivar'];

const TOOL_LABELS: Record<string, string> = {
  consultar_stock: 'Consultó stock',
  cotizar_producto: 'Cotizó',
  fecha_entrega: 'Calculó la fecha',
  buscar_cliente: 'Buscó el cliente',
  crear_presupuesto: 'Creó el presupuesto',
  aceptar_presupuesto_y_crear_pedido: 'Creó el pedido',
  responder: 'Respondió',
  derivar: 'Derivó a Isaías',
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

const productQuantity = {
  type: 'object' as const,
  properties: {
    productId: { type: 'string', description: 'Id del producto (prod-…)' },
    quantity: { type: 'integer', minimum: 1 },
  },
  required: ['productId', 'quantity'],
};

/** Definición de las herramientas para la API de Claude. Cliente y canal los pone el código. */
export const ATTENDANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'consultar_stock',
    description:
      'Busca productos publicados del catálogo por nombre o id y devuelve precio de lista y stock disponible.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Parte del nombre' },
        productId: { type: 'string' },
      },
    },
  },
  {
    name: 'cotizar_producto',
    description:
      'Precio de un producto del catálogo para este cliente, con las reglas de Odell (lista o mayorista).',
    input_schema: productQuantity,
  },
  {
    name: 'fecha_entrega',
    description:
      'Fecha de entrega más temprana (YYYY-MM-DD) para una cantidad de un producto: con stock o produciéndolo en la cola.',
    input_schema: productQuantity,
  },
  {
    name: 'buscar_cliente',
    description:
      'Busca si el cliente de este chat ya existe en Odell (por el chat o por teléfono).',
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Teléfono que dio el cliente' },
      },
    },
  },
  {
    name: 'crear_presupuesto',
    description:
      'Crea el presupuesto (queda Enviado) para el cliente de este chat; si no existe, lo crea como Particular.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          items: productQuantity,
        },
        name: { type: 'string', description: 'Nombre del cliente' },
        phone: {
          type: 'string',
          description:
            'Teléfono del cliente (obligatorio en Instagram y Messenger)',
        },
      },
      required: ['items', 'name'],
    },
  },
  {
    name: 'aceptar_presupuesto_y_crear_pedido',
    description:
      'Solo con la confirmación explícita del cliente: acepta el presupuesto y crea el pedido con la fecha acordada.',
    input_schema: {
      type: 'object',
      properties: {
        quoteId: { type: 'string' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['quoteId', 'dueDate'],
    },
  },
  {
    name: 'responder',
    description: 'Manda el mensaje al cliente. Cierra tu turno.',
    input_schema: {
      type: 'object',
      properties: { texto: { type: 'string' } },
      required: ['texto'],
    },
  },
  {
    name: 'derivar',
    description:
      'Pasa el chat a Isaías: le avisa al cliente que lo consultás y deja tu borrador. Cierra tu turno.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Por qué derivás, corto' },
        borrador: {
          type: 'string',
          description: 'Respuesta que le darías al cliente',
        },
      },
      required: ['motivo', 'borrador'],
    },
    cache_control: { type: 'ephemeral' },
  },
];

export interface AttendantToolContext {
  conversationId: string;
  settings: AttendantSettings;
  now: Date;
  /** Mensajes que el agente mandó al cliente en esta corrida. */
  replyMessageIds: string[];
}

export interface AttendantToolOutput {
  result: unknown;
  summary: AgentToolSummary;
}

type Input = Record<string, unknown>;

function lastTenDigits(value: string | null | undefined): string {
  return onlyDigits(value).slice(-10);
}

/** Ejecutores de las herramientas del agente de atención (§28.3). */
@Injectable()
export class AttendantTools {
  constructor(
    private readonly store: StoreService,
    private readonly mcpTools: McpToolsService,
    private readonly quotes: QuotesService,
    private readonly customers: CustomersService,
    private readonly chats: ChatsService,
    private readonly chatRepository: ChatRepository,
    private readonly printerQueue: PrinterQueueService,
    private readonly notifier: AlertsNotifier,
    private readonly storeChange: StoreChangeService,
  ) {}

  async execute(
    name: string,
    input: Input,
    ctx: AttendantToolContext,
  ): Promise<AttendantToolOutput> {
    const output = await this.run(name, input, ctx);
    return {
      result: output.result,
      summary: { tool: name, label: toolLabel(name), detail: output.detail },
    };
  }

  /** Fecha más temprana para entregar `quantity` de un producto. */
  deliveryDate(
    product: Product,
    quantity: number,
    settings: AttendantSettings,
    now: Date,
  ): { date: string; detail: string } {
    const today = arTodayKey(now);
    const { available } = buildProductStockOverview(this.store, product.id);
    if (available >= quantity) {
      const date = addCalendarDaysToKey(today, settings.stockDeliveryDays);
      return { date, detail: `${available} en stock: entrega ${date}` };
    }
    const line = catalogLine(product, quantity - available);
    if (line.serviceType !== ServiceType.IMPRESION_3D) {
      throw new BadRequestException(
        `No hay stock de ${product.name} y no se produce en la cola de impresión`,
      );
    }
    const hours = estimateTaskHours(
      line,
      TaskType.PRODUCTION,
      this.store.products,
    );
    if (hours > MAX_QUEUE_HOURS) {
      throw new BadRequestException(
        `${hours} h de impresión: es demasiado para calcularlo solo`,
      );
    }
    const queueDate = this.printerQueue.deliveryEstimate(hours, now).date;
    const date = addCalendarDaysToKey(
      queueDate,
      businessDaysToCalendarDays(queueDate, settings.deliveryMarginDays),
    );
    return {
      date,
      detail: `${available} en stock, faltan ${line.quantity}: ${hours} h de impresión → ${date}`,
    };
  }

  private async run(
    name: string,
    input: Input,
    ctx: AttendantToolContext,
  ): Promise<{ result: unknown; detail: string }> {
    const conversation = this.conversation(ctx.conversationId);
    switch (name) {
      case 'consultar_stock': {
        const result = this.mcpTools.consultarStock({
          query: this.optionalText(input.query),
          productId: this.optionalText(input.productId),
        });
        const detail = result.length
          ? result
              .slice(0, 3)
              .map((row) => `${row.name}: ${row.stock.available} disponibles`)
              .join(', ')
          : 'sin resultados';
        return { result, detail };
      }
      case 'cotizar_producto': {
        const customer = this.linkedCustomer(conversation);
        const result = this.mcpTools.cotizarProducto({
          productId: this.text(input.productId, 'productId'),
          quantity: this.quantity(input.quantity),
          customerId: customer?.id,
        });
        const who = !customer
          ? 'sin cliente vinculado'
          : customer.type === CustomerType.REVENDEDOR
            ? 'es revendedor'
            : 'no es revendedor';
        const price = result.wholesaleApplied ? 'mayorista' : 'lista';
        return {
          result,
          detail: `${result.quantity} ${result.name}: ${price} ${formatMoney(result.total)}, ${who}`,
        };
      }
      case 'fecha_entrega': {
        const product = findPublishedProduct(
          this.store,
          this.text(input.productId, 'productId'),
        );
        const quantity = this.quantity(input.quantity);
        const { date, detail } = this.deliveryDate(
          product,
          quantity,
          ctx.settings,
          ctx.now,
        );
        return { result: { fecha: date }, detail };
      }
      case 'buscar_cliente': {
        const customer = this.findCustomer(
          conversation,
          this.optionalText(input.phone),
        );
        return {
          result: customer
            ? {
                encontrado: true,
                cliente: {
                  id: customer.id,
                  nombre: customer.name,
                  tipo: customer.type,
                },
              }
            : { encontrado: false },
          detail: customer ? `existe: ${customer.name}` : 'no existe todavía',
        };
      }
      case 'crear_presupuesto':
        return this.createQuote(conversation, input);
      case 'aceptar_presupuesto_y_crear_pedido':
        return this.acceptQuote(conversation, input, ctx);
      case 'responder': {
        const message = await this.chats.sendOutbound(conversation.id, {
          text: this.text(input.texto, 'texto'),
          author: ChatAuthor.AGENT,
        });
        ctx.replyMessageIds.push(message.id);
        return { result: { enviado: true }, detail: 'mensaje enviado' };
      }
      case 'derivar':
        return this.handOff(conversation, input, ctx);
      default:
        throw new BadRequestException(`Herramienta desconocida: ${name}`);
    }
  }

  private createQuote(
    conversation: ChatConversation,
    input: Input,
  ): { result: unknown; detail: string } {
    const rawItems = Array.isArray(input.items) ? (input.items as Input[]) : [];
    if (!rawItems.length) {
      throw new BadRequestException('El presupuesto necesita productos');
    }
    const items = rawItems.map((item) =>
      catalogLine(
        findPublishedProduct(
          this.store,
          this.text(item.productId, 'productId'),
        ),
        this.quantity(item.quantity),
      ),
    );
    const { customer, detail: customerDetail } = this.resolveCustomer(
      conversation,
      this.text(input.name, 'name'),
      this.optionalText(input.phone),
    );
    const quote = this.quotes.create({
      customerId: customer.id,
      items,
      salesChannel: conversation.channel as unknown as SalesChannel,
      description: AGENT_QUOTE_DESCRIPTION,
      status: QuoteStatus.ENVIADO,
    });
    this.storeChange.recordHttpMutation('/api/quotes', 'POST', quote);
    return {
      result: {
        quoteId: quote.id,
        total: quote.total,
        items: quote.items.map((item) => ({
          nombre: item.productName,
          cantidad: item.quantity,
          precioUnitario: item.unitPrice,
        })),
      },
      detail: `${quote.id} por ${formatMoney(quote.total)}; ${customerDetail}`,
    };
  }

  private acceptQuote(
    conversation: ChatConversation,
    input: Input,
    ctx: AttendantToolContext,
  ): { result: unknown; detail: string } {
    const quote = this.quotes.findOne(this.text(input.quoteId, 'quoteId'));
    if (
      !conversation.customerId ||
      quote.customerId !== conversation.customerId
    ) {
      throw new BadRequestException('Ese presupuesto no es de este cliente');
    }
    if (quote.status !== QuoteStatus.ENVIADO) {
      throw new BadRequestException(
        'Solo se puede confirmar un presupuesto enviado',
      );
    }
    const dueDate = this.text(input.dueDate, 'dueDate');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new BadRequestException('La fecha tiene que ser YYYY-MM-DD');
    }
    const earliest = quote.items
      .map((item) => {
        if (!item.productId) {
          throw new BadRequestException('Hay una línea fuera del catálogo');
        }
        return this.deliveryDate(
          findPublishedProduct(this.store, item.productId),
          item.quantity,
          ctx.settings,
          ctx.now,
        ).date;
      })
      .sort()
      .pop()!;
    if (dueDate < earliest) {
      throw new BadRequestException(
        `La fecha pedida es anterior a la que se puede cumplir (${earliest})`,
      );
    }
    const accepted = this.quotes.updateStatus(
      quote.id,
      QuoteStatus.ACEPTADO,
      undefined,
      { dueDate: `${dueDate}T18:00:00.000Z`, createdByAgent: true },
    );
    return {
      result: { orderId: accepted.orderId, fecha: dueDate },
      detail: `pedido ${accepted.orderId} desde ${quote.id}, entrega ${dueDate}`,
    };
  }

  private async handOff(
    conversation: ChatConversation,
    input: Input,
    ctx: AttendantToolContext,
  ): Promise<{ result: unknown; detail: string }> {
    const reason = this.text(input.motivo, 'motivo');
    const draft = this.text(input.borrador, 'borrador');
    let sent = true;
    try {
      const message = await this.chats.sendOutbound(conversation.id, {
        text: HANDOFF_MESSAGE,
        author: ChatAuthor.AGENT,
      });
      ctx.replyMessageIds.push(message.id);
    } catch {
      sent = false;
    }
    this.chats.setHandedOff(conversation.id, true);
    this.chats.createSuggestion(conversation.id, { text: draft });
    const name =
      this.linkedCustomer(conversation)?.name ??
      conversation.displayName ??
      conversation.externalId;
    await this.notifier.notifyOwnerWhatsApp(
      `Te derivó ${name} (${CHANNEL_LABELS[conversation.channel]}): ${reason}`,
    );
    return {
      result: { derivado: true },
      detail: sent ? reason : `${reason} (no salió el aviso al cliente)`,
    };
  }

  /** Cliente del chat: el vinculado, uno con el mismo teléfono o uno nuevo. */
  private resolveCustomer(
    conversation: ChatConversation,
    name: string,
    phone: string | undefined,
  ): { customer: Customer; detail: string } {
    const existing = this.findCustomer(conversation, phone);
    if (existing) {
      if (conversation.customerId !== existing.id) {
        this.link(conversation.id, existing.id);
      }
      return { customer: existing, detail: `cliente ${existing.name}` };
    }
    const customerPhone = phone ?? this.channelPhone(conversation);
    if (!customerPhone) {
      throw new BadRequestException(
        'Falta el teléfono: pedíselo al cliente antes de crear el presupuesto',
      );
    }
    const customer = this.customers.create({
      name,
      phone: customerPhone,
      type: CustomerType.PARTICULAR,
      source: conversation.channel as unknown as CustomerSource,
    });
    this.storeChange.recordHttpMutation('/api/customers', 'POST', customer);
    this.link(conversation.id, customer.id);
    return {
      customer,
      detail: `cliente creado como Particular, origen ${CHANNEL_LABELS[conversation.channel]}`,
    };
  }

  private findCustomer(
    conversation: ChatConversation,
    phone: string | undefined,
  ): Customer | null {
    const linked = this.linkedCustomer(conversation);
    if (linked) return linked;
    const digits = lastTenDigits(phone ?? this.channelPhone(conversation));
    if (!digits) return null;
    return (
      this.store.customers.find(
        (customer) => lastTenDigits(customer.phone) === digits,
      ) ?? null
    );
  }

  private linkedCustomer(conversation: ChatConversation): Customer | null {
    if (!conversation.customerId) return null;
    return (
      this.store.customers.find((c) => c.id === conversation.customerId) ?? null
    );
  }

  /** En WhatsApp el usuario del canal es el teléfono. */
  private channelPhone(conversation: ChatConversation): string | null {
    if (conversation.channel !== ChatChannel.WHATSAPP) return null;
    return conversation.displayPhone || conversation.externalId;
  }

  private link(conversationId: string, customerId: string): void {
    this.chats.linkCustomer(conversationId, customerId);
    this.storeChange.recordHttpMutation(
      `/api/chats/${conversationId}/customer`,
      'PUT',
      { customerId },
    );
  }

  private conversation(id: string): ChatConversation {
    const conversation = this.chatRepository.findConversationById(id);
    if (!conversation) {
      throw new BadRequestException('Conversación no encontrada');
    }
    return conversation;
  }

  private text(value: unknown, field: string): string {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) throw new BadRequestException(`Falta ${field}`);
    return text;
  }

  private optionalText(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private quantity(value: unknown): number {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException(
        'La cantidad tiene que ser un entero mayor a 0',
      );
    }
    return quantity;
  }
}
