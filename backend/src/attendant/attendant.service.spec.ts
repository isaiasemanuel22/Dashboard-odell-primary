import type Anthropic from '@anthropic-ai/sdk';
import { AlertsNotifier } from '../alerts/alerts-notifier';
import { ChatsService } from '../chats/chats.service';
import {
  ChatChannel,
  ChatMessageStatus,
  CustomerSource,
  CustomerType,
  ProductType,
  QuoteStatus,
} from '../common/enums';
import { AttendantSettings, Product } from '../common/interfaces';
import { arTodayKey } from '../common/utils/ar-date.util';
import { AppConfigService } from '../config/app-config.service';
import { CustomersService } from '../customers/customers.service';
import { McpToolsService } from '../mcp/mcp-tools.service';
import { MetaInboundEvents } from '../meta/meta-inbound.events';
import { OrdersService } from '../orders/orders.service';
import { OrderTasksService } from '../print-jobs/order-tasks.service';
import { PrintJobsService } from '../print-jobs/print-jobs.service';
import { PrinterQueueService } from '../print-jobs/printer-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { AgentApprovalsService } from '../agent-approvals/agent-approvals.service';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { normalizeAttendant } from '../settings/attendant-settings.util';
import { SettingsService } from '../settings/settings.service';
import {
  ChatRepository,
  CustomerRepository,
  OrderRepository,
  ProductRepository,
  QuoteRepository,
} from '../store/repositories';
import { StoreChangeService } from '../store/store-change.service';
import { createEmptyState } from '../store/store.seed';
import { StoreService } from '../store/store.service';
import { addCalendarDaysToKey } from '../supplies/business-days.util';
import { AttendantService } from './attendant.service';
import { AttendantTools, HANDOFF_MESSAGE } from './attendant-tools';
import { AttendantUsageService } from './attendant-usage.service';

const OWNER_PHONE = '5491100000000';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Taza',
    type: ProductType.FDM,
    images: [],
    attachments: [],
    updatedAt: '2026-10-21T12:00:00.000Z',
    price: 1000,
    cost: 400,
    profit: 600,
    categoryIds: [],
    size: '10 cm',
    published: true,
    components: [],
    assemblyTimeHours: 0,
    includesPieces: false,
    grams: 10,
    printTimeHours: 3,
    workTimeHours: 0,
    stock: 3,
    ...overrides,
  } as Product;
}

function usage(input = 100, output = 20) {
  return {
    input_tokens: input,
    output_tokens: output,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
}

function toolUse(name: string, input: Record<string, unknown>, id = name) {
  return {
    content: [{ type: 'tool_use', id, name, input }],
    stop_reason: 'tool_use',
    usage: usage(),
  };
}

function setup(attendant: Partial<AttendantSettings> = { enabled: true }) {
  const store = new StoreService();
  const state = createEmptyState();
  state.products.push(product());
  state.customers.push({
    id: 'cust-1',
    name: 'Ana',
    email: '',
    phone: '11 5555-1234',
    type: CustomerType.PARTICULAR,
    createdAt: '2026-10-21T12:00:00.000Z',
  });
  store.applyState(state);

  const storeChange = {
    recordChange: jest.fn(),
    recordHttpMutation: jest.fn(),
  } as unknown as StoreChangeService;
  const orderTasks = new OrderTasksService(store);
  const orders = new OrdersService(
    new OrderRepository(store),
    new CustomerRepository(store),
    new ProductRepository(store),
    orderTasks,
    new PrintJobsService(store, orderTasks),
    new CostCalculatorService(store),
    store,
  );
  const quotes = new QuotesService(
    new QuoteRepository(store),
    new CustomerRepository(store),
    orders,
    new ProductRepository(store),
    store,
    storeChange,
  );
  const printerQueue = {
    deliveryEstimate: jest.fn(() => ({ date: '2026-11-20', printerId: 'p1' })),
  };
  const gateway = { send: jest.fn().mockResolvedValue({}) };
  const chatRepository = new ChatRepository(store);
  const chats = new ChatsService(
    chatRepository,
    new CustomerRepository(store),
    new OrderRepository(store),
    new QuoteRepository(store),
    storeChange,
    gateway,
  );
  const notifier = {
    notifyOwnerWhatsApp: jest.fn().mockResolvedValue(undefined),
  };
  let settingsValue = normalizeAttendant(attendant);
  const settings = {
    getAttendant: () => settingsValue,
    updateAttendant: jest.fn((data: Partial<AttendantSettings>) => {
      settingsValue = normalizeAttendant({ ...settingsValue, ...data });
      return settingsValue;
    }),
  };
  const config = {
    nodeEnv: 'test',
    anthropicModel: 'claude-sonnet-5-5',
    alertsWhatsAppTo: OWNER_PHONE,
  } as AppConfigService;
  const tools = new AttendantTools(
    store,
    new McpToolsService(
      store,
      quotes,
      orders,
      printerQueue as unknown as PrinterQueueService,
      {} as AgentApprovalsService,
      storeChange,
    ),
    quotes,
    new CustomersService(new CustomerRepository(store)),
    chats,
    chatRepository,
    printerQueue as unknown as PrinterQueueService,
    notifier as unknown as AlertsNotifier,
    storeChange,
  );
  const usageService = new AttendantUsageService({
    isConfigured: () => false,
  } as PrismaService);
  const client = { messages: { create: jest.fn() } };
  const build = (withClient = true) =>
    new AttendantService(
      withClient ? (client as unknown as Pick<Anthropic, 'messages'>) : null,
      new MetaInboundEvents(),
      tools,
      usageService,
      settings as unknown as SettingsService,
      chats,
      chatRepository,
      new CustomerRepository(store),
      notifier as unknown as AlertsNotifier,
      config,
    );
  const inbound = (
    channel = ChatChannel.WHATSAPP,
    externalId = '5491155551234',
    text = 'Hola, ¿cuánto sale la taza?',
  ) => chats.registerInbound({ channel, externalId, displayName: 'Ana', text });

  return {
    store,
    service: build(),
    build,
    client,
    gateway,
    notifier,
    settings,
    tools,
    usageService,
    chatRepository,
    printerQueue,
    inbound,
  };
}

describe('AttendantService', () => {
  describe('no responde', () => {
    it('si el agente está apagado, sin guardar la corrida', async () => {
      const ctx = setup({ enabled: false });
      const { conversation, message } = ctx.inbound();
      await ctx.service.enqueue(conversation.id, message.id);
      expect(await ctx.usageService.recentRuns(conversation.id)).toEqual([]);
      expect(ctx.client.messages.create).not.toHaveBeenCalled();
    });

    it('sin ANTHROPIC_API_KEY, sin guardar la corrida', async () => {
      const ctx = setup();
      const { conversation, message } = ctx.inbound();
      await ctx.build(false).enqueue(conversation.id, message.id);
      expect(await ctx.usageService.recentRuns(conversation.id)).toEqual([]);
    });

    it('si Isaías pausó el chat', async () => {
      const ctx = setup();
      const { conversation, message } = ctx.inbound();
      ctx.chatRepository.saveConversation({
        ...conversation,
        agentPaused: true,
      });
      await ctx.service.enqueue(conversation.id, message.id);
      const [run] = await ctx.usageService.recentRuns(conversation.id);
      expect(run.toolSummary[0].detail).toBe('El chat está pausado');
      expect(ctx.client.messages.create).not.toHaveBeenCalled();
    });

    it('si escribe el número de Isaías', async () => {
      const ctx = setup();
      const { conversation, message } = ctx.inbound(
        ChatChannel.WHATSAPP,
        OWNER_PHONE,
      );
      await ctx.service.enqueue(conversation.id, message.id);
      const [run] = await ctx.usageService.recentRuns(conversation.id);
      expect(run.toolSummary[0].detail).toBe('Es el número de Isaías');
    });

    it('pasado el tope: se pausa y avisa a Isaías', async () => {
      const ctx = setup({ enabled: true, monthlyBudgetUsd: 20 });
      await ctx.usageService.save({
        conversationId: 'otro',
        triggerMessageId: 'm',
        outcome: 'replied',
        toolSummary: [],
        replyMessageIds: [],
        model: 'claude-sonnet-5-5',
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 20.5,
        error: null,
      });
      const { conversation, message } = ctx.inbound();
      await ctx.service.enqueue(conversation.id, message.id);
      expect(ctx.client.messages.create).not.toHaveBeenCalled();
      expect(ctx.settings.getAttendant().enabled).toBe(false);
      expect(ctx.settings.getAttendant().pausedByBudgetAt).not.toBeNull();
      expect(ctx.notifier.notifyOwnerWhatsApp).toHaveBeenCalledWith(
        'El agente se pausó: llegó al tope de USD 20 del mes',
      );
    });
  });

  it('cotiza con la herramienta y responde al cliente', async () => {
    const ctx = setup();
    ctx.client.messages.create
      .mockResolvedValueOnce(
        toolUse('cotizar_producto', { productId: 'prod-1', quantity: 2 }),
      )
      .mockResolvedValueOnce(
        toolUse('responder', { texto: 'Dos tazas salen $2.000' }),
      );
    const { conversation, message } = ctx.inbound();
    ctx.chatRepository.saveConversation({
      ...conversation,
      customerId: 'cust-1',
    });
    await ctx.service.enqueue(conversation.id, message.id);

    expect(ctx.client.messages.create).toHaveBeenCalledTimes(2);
    const calls = ctx.client.messages.create.mock.calls as unknown as [
      { messages: { role: string; content: unknown }[] },
    ][];
    const second = calls[1][0];
    expect(second.messages[0]).toEqual({
      role: 'user',
      content: 'Hola, ¿cuánto sale la taza?',
    });
    expect(second.messages[2].role).toBe('user');
    expect(ctx.gateway.send).toHaveBeenCalledTimes(1);
    const [run] = await ctx.usageService.recentRuns(conversation.id);
    expect(run.outcome).toBe('replied');
    expect(run.inputTokens).toBe(200);
    expect(run.outputTokens).toBe(40);
    expect(run.replyMessageIds).toHaveLength(1);
    expect(run.toolSummary.map((s) => s.tool)).toEqual([
      'cotizar_producto',
      'responder',
    ]);
    expect(run.toolSummary[0].detail).toContain('lista');
    expect(run.toolSummary[0].detail).toContain('no es revendedor');
  });

  it('al derivar: avisa al cliente, marca el chat, deja borrador y le escribe a Isaías', async () => {
    const ctx = setup();
    ctx.client.messages.create.mockResolvedValueOnce(
      toolUse('derivar', {
        motivo: 'pide descuento',
        borrador: 'El precio es el de lista',
      }),
    );
    const { conversation, message } = ctx.inbound();
    await ctx.service.enqueue(conversation.id, message.id);

    const chat = ctx.chatRepository.findConversationById(conversation.id)!;
    expect(chat.handedOff).toBe(true);
    expect(chat.agentPaused).toBe(true);
    const messages = ctx.chatRepository
      .findAllMessages()
      .filter((m) => m.conversationId === conversation.id);
    expect(messages.map((m) => [m.status, m.text])).toEqual([
      [ChatMessageStatus.RECEIVED, 'Hola, ¿cuánto sale la taza?'],
      [ChatMessageStatus.SENT, HANDOFF_MESSAGE],
      [ChatMessageStatus.SUGGESTED, 'El precio es el de lista'],
    ]);
    expect(ctx.notifier.notifyOwnerWhatsApp).toHaveBeenCalledWith(
      'Te derivó Ana (WhatsApp): pide descuento',
    );
    const [run] = await ctx.usageService.recentRuns(conversation.id);
    expect(run.outcome).toBe('handed_off');
  });

  it('si termina sin responder ni derivar, lo que escribió queda para aprobar', async () => {
    const ctx = setup();
    ctx.client.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hola Ana' }],
      stop_reason: 'end_turn',
      usage: usage(),
    });
    const { conversation, message } = ctx.inbound();
    await ctx.service.enqueue(conversation.id, message.id);
    const [run] = await ctx.usageService.recentRuns(conversation.id);
    expect(run.outcome).toBe('suggested');
    expect(ctx.gateway.send).not.toHaveBeenCalled();
  });

  it('si la corrida llega al tope, se pausa y avisa', async () => {
    const ctx = setup({ enabled: true, monthlyBudgetUsd: 1 });
    ctx.client.messages.create.mockResolvedValueOnce({
      ...toolUse('responder', { texto: 'Hola' }),
      usage: usage(400_000, 0),
    });
    const { conversation, message } = ctx.inbound();
    await ctx.service.enqueue(conversation.id, message.id);
    expect(ctx.settings.getAttendant().enabled).toBe(false);
    expect(ctx.notifier.notifyOwnerWhatsApp).toHaveBeenCalledWith(
      'El agente se pausó: llegó al tope de USD 1 del mes',
    );
  });

  it('un error de la API queda registrado y no responde', async () => {
    const ctx = setup();
    ctx.client.messages.create.mockRejectedValueOnce(new Error('timeout'));
    const { conversation, message } = ctx.inbound();
    await ctx.service.enqueue(conversation.id, message.id);
    const [run] = await ctx.usageService.recentRuns(conversation.id);
    expect(run.outcome).toBe('error');
    expect(run.error).toBe('timeout');
    expect(ctx.gateway.send).not.toHaveBeenCalled();
  });

  it('varios mensajes mientras corre: una sola corrida extra', async () => {
    const ctx = setup();
    let release!: () => void;
    const reply = {
      content: [{ type: 'text', text: 'Hola' }],
      stop_reason: 'end_turn',
      usage: usage(),
    };
    ctx.client.messages.create
      .mockImplementationOnce(
        () => new Promise((resolve) => (release = () => resolve(reply))),
      )
      .mockResolvedValue(reply);
    const first = ctx.inbound();
    const running = ctx.service.enqueue(
      first.conversation.id,
      first.message.id,
    );
    while (!ctx.client.messages.create.mock.calls.length) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    const second = ctx.inbound();
    const third = ctx.inbound();
    void ctx.service.enqueue(first.conversation.id, second.message.id);
    void ctx.service.enqueue(first.conversation.id, third.message.id);
    void ctx.service.enqueue(first.conversation.id, third.message.id);
    release();
    await running;

    expect(ctx.client.messages.create).toHaveBeenCalledTimes(2);
    const runs = await ctx.usageService.recentRuns(first.conversation.id, 10);
    expect(runs.map((run) => run.triggerMessageId)).toEqual([
      third.message.id,
      first.message.id,
    ]);
  });

  it('si entra un mensaje mientras responde, la corrida extra lo procesa', async () => {
    const ctx = setup();
    let release!: () => void;
    ctx.client.messages.create
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () =>
              resolve(toolUse('responder', { texto: 'La taza sale $1.000' }));
          }),
      )
      .mockResolvedValueOnce(
        toolUse('responder', { texto: 'Sí, hay en rojo' }),
      );
    const a = ctx.inbound(ChatChannel.WHATSAPP, '5491155551234', 'Hola');
    const running = ctx.service.enqueue(a.conversation.id, a.message.id);
    while (!ctx.client.messages.create.mock.calls.length) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    const b = ctx.inbound(
      ChatChannel.WHATSAPP,
      '5491155551234',
      '¿Hay en rojo?',
    );
    void ctx.service.enqueue(a.conversation.id, b.message.id);
    // La respuesta a A sale después de B.
    await new Promise((resolve) => setTimeout(resolve, 5));
    release();
    await running;

    expect(ctx.client.messages.create).toHaveBeenCalledTimes(2);
    const calls = ctx.client.messages.create.mock.calls as unknown as [
      { messages: { role: string; content: unknown }[] },
    ][];
    expect(calls[1][0].messages.slice(0, 3)).toEqual([
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'La taza sale $1.000' },
      { role: 'user', content: '¿Hay en rojo?' },
    ]);
    const runs = await ctx.usageService.recentRuns(a.conversation.id, 10);
    expect(runs.map((run) => [run.triggerMessageId, run.outcome])).toEqual([
      [b.message.id, 'replied'],
      [a.message.id, 'replied'],
    ]);
    expect(ctx.gateway.send).toHaveBeenCalledTimes(2);
  });

  it('no deja reactivar pasado el tope sin subirlo', async () => {
    const ctx = setup({ enabled: false, pausedByBudgetAt: 'x' });
    await ctx.usageService.save({
      conversationId: 'otro',
      triggerMessageId: 'm',
      outcome: 'replied',
      toolSummary: [],
      replyMessageIds: [],
      model: 'm',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 25,
      error: null,
    });
    await expect(ctx.service.updateSettings({ enabled: true })).rejects.toThrow(
      'Subí el tope o esperá al mes que viene',
    );
    const updated = await ctx.service.updateSettings({
      enabled: true,
      monthlyBudgetUsd: 30,
    });
    expect(updated.enabled).toBe(true);
    expect(updated.pausedByBudgetAt).toBeNull();
  });
});

describe('AttendantTools', () => {
  const settings = normalizeAttendant({ enabled: true });

  function context(conversationId: string, now = new Date()) {
    return { conversationId, settings, now, replyMessageIds: [] };
  }

  it('fecha con stock: hoy + 1; sin stock: cola + 2 días hábiles', async () => {
    const ctx = setup();
    const { conversation } = ctx.inbound();
    const now = new Date('2026-11-19T15:00:00.000Z');

    const withStock = await ctx.tools.execute(
      'fecha_entrega',
      { productId: 'prod-1', quantity: 3 },
      context(conversation.id, now),
    );
    expect(withStock.result).toEqual({ fecha: '2026-11-20' });

    // Cola: viernes 20 → + 2 hábiles = martes 24.
    const withoutStock = await ctx.tools.execute(
      'fecha_entrega',
      { productId: 'prod-1', quantity: 10 },
      context(conversation.id, now),
    );
    expect(withoutStock.result).toEqual({ fecha: '2026-11-24' });
    expect(ctx.printerQueue.deliveryEstimate).toHaveBeenCalledWith(21, now);
    expect(withoutStock.summary.detail).toBe(
      '3 en stock, faltan 7: 21 h de impresión → 2026-11-24',
    );
  });

  it('cliente nuevo en Instagram: Particular, origen Instagram y chat vinculado', async () => {
    const ctx = setup();
    const { conversation } = ctx.inbound(ChatChannel.INSTAGRAM, 'ig-123');
    const output = await ctx.tools.execute(
      'crear_presupuesto',
      {
        items: [{ productId: 'prod-1', quantity: 2 }],
        name: 'Bruno',
        phone: '11 4444-0000',
      },
      context(conversation.id),
    );
    const customer = ctx.store.customers.find((c) => c.name === 'Bruno')!;
    expect(customer.type).toBe(CustomerType.PARTICULAR);
    expect(customer.source).toBe(CustomerSource.INSTAGRAM);
    expect(
      ctx.chatRepository.findConversationById(conversation.id)!.customerId,
    ).toBe(customer.id);
    const quote = ctx.store.quotes[0];
    expect(quote.status).toBe(QuoteStatus.ENVIADO);
    expect(quote.customerId).toBe(customer.id);
    expect(quote.salesChannel).toBe('instagram');
    expect(output.summary.detail).toContain(
      'cliente creado como Particular, origen Instagram',
    );
  });

  it('en Instagram sin teléfono no crea el presupuesto', async () => {
    const ctx = setup();
    const { conversation } = ctx.inbound(ChatChannel.INSTAGRAM, 'ig-123');
    await expect(
      ctx.tools.execute(
        'crear_presupuesto',
        { items: [{ productId: 'prod-1', quantity: 1 }], name: 'Bruno' },
        context(conversation.id),
      ),
    ).rejects.toThrow('Falta el teléfono');
    expect(ctx.store.quotes).toHaveLength(0);
    expect(ctx.store.customers).toHaveLength(1);
  });

  it('en WhatsApp reconoce al cliente por los últimos 10 dígitos', async () => {
    const ctx = setup();
    const { conversation } = ctx.inbound();
    await ctx.tools.execute(
      'crear_presupuesto',
      { items: [{ productId: 'prod-1', quantity: 1 }], name: 'Ana' },
      context(conversation.id),
    );
    expect(ctx.store.customers).toHaveLength(1);
    expect(
      ctx.chatRepository.findConversationById(conversation.id)!.customerId,
    ).toBe('cust-1');
  });

  it('aceptar presupuesto: rechaza una fecha anterior y crea el pedido del agente', async () => {
    const ctx = setup();
    const { conversation } = ctx.inbound();
    const created = await ctx.tools.execute(
      'crear_presupuesto',
      { items: [{ productId: 'prod-1', quantity: 2 }], name: 'Ana' },
      context(conversation.id),
    );
    const { quoteId } = created.result as { quoteId: string };
    const today = arTodayKey();

    await expect(
      ctx.tools.execute(
        'aceptar_presupuesto_y_crear_pedido',
        { quoteId, dueDate: today },
        context(conversation.id),
      ),
    ).rejects.toThrow('anterior a la que se puede cumplir');
    expect(ctx.store.orders).toHaveLength(0);

    const dueDate = addCalendarDaysToKey(today, 3);
    await ctx.tools.execute(
      'aceptar_presupuesto_y_crear_pedido',
      { quoteId, dueDate },
      context(conversation.id),
    );
    const [order] = ctx.store.orders;
    expect(order.createdByAgent).toBe(true);
    expect(order.dueDate.slice(0, 10)).toBe(dueDate);
    expect(ctx.store.quotes[0].status).toBe(QuoteStatus.ACEPTADO);
    expect(ctx.store.quotes[0].orderId).toBe(order.id);
  });
});
