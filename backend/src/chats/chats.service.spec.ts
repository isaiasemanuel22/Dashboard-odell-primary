import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatAuthor,
  ChatChannel,
  ChatMessageStatus,
  ChatStatus,
} from '../common/enums';
import { buildSeedChats, createEmptyState } from '../store/store.seed';
import { StoreService } from '../store/store.service';
import {
  ChatRepository,
  CustomerRepository,
  OrderRepository,
  QuoteRepository,
} from '../store/repositories';
import { ChatsService } from './chats.service';

describe('ChatsService', () => {
  let store: StoreService;
  let gateway: { send: jest.Mock };
  let recordChange: jest.Mock;
  let service: ChatsService;

  beforeEach(() => {
    store = new StoreService();
    store.applyState(createEmptyState());
    const seed = buildSeedChats(new Date());
    store.chatConversations.push(...seed.chatConversations);
    store.chatMessages.push(...seed.chatMessages);
    store.quotes.push(seed.quote);
    store.customers.push(
      ...([
        {
          id: 'cust-1',
          name: 'María González',
          email: '',
          phone: '',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'cust-3',
          name: 'Lucía Fernández',
          email: '',
          phone: '',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'cust-5',
          name: 'Martina Paz',
          email: '',
          phone: '',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ] as never[]),
    );
    gateway = {
      send: jest.fn().mockResolvedValue({ externalMessageId: 'x1' }),
    };
    recordChange = jest.fn();
    service = new ChatsService(
      new ChatRepository(store),
      new CustomerRepository(store),
      new OrderRepository(store),
      new QuoteRepository(store),
      { recordChange } as never,
      gateway,
    );
  });

  it('lista con contadores 3 sin leer, 2 para aprobar y 1 derivado', () => {
    const { conversations, counts } = service.list();
    expect(conversations).toHaveLength(6);
    expect(counts).toEqual({
      all: 6,
      unread: 3,
      pendingApproval: 2,
      handedOff: 1,
      byChannel: { whatsapp: 3, instagram: 2, messenger: 1 },
    });
    // Más reciente primero.
    expect(conversations[0].id).toBe('chat-2');
    const martina = conversations.find((c) => c.id === 'chat-1')!;
    expect(martina.contactName).toBe('Martina Paz');
    expect(martina.status).toBe(ChatStatus.PENDING_APPROVAL);
    expect(martina.lastMessagePreview).toContain('Te armo el presupuesto');
    expect(conversations.find((c) => c.id === 'chat-6')!.windowOpen).toBe(
      false,
    );
    expect(service.unreadCount()).toEqual({ unreadConversations: 3 });
  });

  it('filtra por canal y estado; los contadores ignoran esos filtros', () => {
    const result = service.list({
      channel: ChatChannel.WHATSAPP,
      filter: 'unread',
    });
    expect(result.conversations.map((c) => c.id).sort()).toEqual([
      'chat-1',
      'chat-3',
    ]);
    expect(result.counts.all).toBe(6);
    expect(
      service.list({ filter: 'handed_off' }).conversations.map((c) => c.id),
    ).toEqual(['chat-3']);
  });

  it('busca por nombre sin tildes y por dígitos del teléfono', () => {
    expect(
      service.list({ search: 'lucia' }).conversations.map((c) => c.id),
    ).toEqual(['chat-5']);
    const byPhone = service.list({ search: '4421 9087' });
    expect(byPhone.conversations.map((c) => c.id)).toEqual(['chat-4']);
    expect(byPhone.counts.all).toBe(1);
  });

  it('el cliente borrado no se informa como vinculado', () => {
    store.customers = store.customers.filter((c) => c.id !== 'cust-3');
    const lucia = service.list().conversations.find((c) => c.id === 'chat-5')!;
    expect(lucia.customerId).toBeNull();
    expect(lucia.contactName).toBe('Lucía Fernández');
  });

  it('detalle con presupuesto de la sugerencia y contexto del cliente', () => {
    const detail = service.detail('chat-1');
    expect(detail.messages).toHaveLength(3);
    expect(detail.suggestionQuotes['quo-4']).toMatchObject({
      total: 145000,
      items: [{ quantity: 10, unitPrice: 14500 }],
    });
    expect(detail.customer?.id).toBe('cust-5');
    expect(detail.customerContext).toEqual({
      lastOrder: null,
      openQuotes: [{ id: 'quo-4', status: 'borrador', total: 145000 }],
    });
    expect(service.detail('chat-2').customerContext).toBeNull();
    expect(() => service.detail('chat-99')).toThrow(NotFoundException);
  });

  it('enviar: valida texto, pasa por el gateway y apaga la derivación', async () => {
    await expect(service.send('chat-3', { text: '  ' })).rejects.toThrow(
      BadRequestException,
    );
    const message = await service.send('chat-3', { text: 'Hola Diego' }, 'u1');
    expect(message).toMatchObject({
      author: ChatAuthor.HUMAN,
      authorUserId: 'u1',
      status: ChatMessageStatus.SENT,
      externalMessageId: 'x1',
    });
    expect(gateway.send).toHaveBeenCalledTimes(1);
    expect(
      store.chatConversations.find((c) => c.id === 'chat-3')!.handedOff,
    ).toBe(false);
  });

  it('si escribe un humano, el agente queda pausado en ese chat', async () => {
    expect(service.detail('chat-1').conversation.agentPaused).toBe(false);
    await service.send('chat-1', { text: 'Hola Martina' });
    expect(service.detail('chat-1').conversation.agentPaused).toBe(true);
  });

  it('sendOutbound: sale por el gateway como agente y registra el cambio', async () => {
    const message = await service.sendOutbound('chat-1', {
      text: ' Ya está listo ',
      author: ChatAuthor.AGENT,
    });
    expect(message).toMatchObject({
      author: ChatAuthor.AGENT,
      authorUserId: null,
      text: 'Ya está listo',
      status: ChatMessageStatus.SENT,
      externalMessageId: 'x1',
    });
    expect(gateway.send).toHaveBeenCalledTimes(1);
    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(service.detail('chat-1').conversation.agentPaused).toBe(false);
  });

  it('sendOutbound fuera de la ventana da 409 y si falla queda fallido', async () => {
    await expect(
      service.sendOutbound('chat-6', {
        text: 'Hola',
        author: ChatAuthor.AGENT,
      }),
    ).rejects.toThrow(ConflictException);
    expect(gateway.send).not.toHaveBeenCalled();

    gateway.send.mockRejectedValueOnce(new Error('Meta caído'));
    await expect(
      service.sendOutbound('chat-1', {
        text: 'Hola',
        author: ChatAuthor.AGENT,
      }),
    ).rejects.toThrow(BadGatewayException);
    expect(store.chatMessages.at(-1)).toMatchObject({
      author: ChatAuthor.AGENT,
      status: ChatMessageStatus.FAILED,
    });
  });

  it('enviar fuera de la ventana de 24 h da 409', async () => {
    await expect(service.send('chat-6', { text: 'Hola' })).rejects.toThrow(
      'Pasaron más de 24 h',
    );
    expect(gateway.send).not.toHaveBeenCalled();
  });

  it('si el gateway falla el mensaje queda fallido y responde 502', async () => {
    gateway.send.mockRejectedValueOnce(new Error('Meta caído'));
    await expect(service.send('chat-1', { text: 'Hola' })).rejects.toThrow(
      BadGatewayException,
    );
    expect(store.chatMessages.at(-1)!.status).toBe(ChatMessageStatus.FAILED);
    expect(recordChange).toHaveBeenCalled();
  });

  it('leer, vincular y desvincular cliente', () => {
    expect(service.markRead('chat-1').unreadCount).toBe(0);
    expect(() => service.linkCustomer('chat-2', 'cust-99')).toThrow(
      NotFoundException,
    );
    expect(() => service.linkCustomer('chat-99', 'cust-1')).toThrow(
      NotFoundException,
    );
    const linked = service.linkCustomer('chat-2', 'cust-1');
    expect(linked.contactName).toBe('María González');
    expect(service.unlinkCustomer('chat-2').customerId).toBeNull();
  });

  it('sugerencias: editar, aprobar y descartar', async () => {
    const edited = service.editSuggestion('chat-2', 'cmsg-5', {
      text: 'Texto nuevo',
    });
    expect(edited.text).toBe('Texto nuevo');

    const approved = await service.approveSuggestion(
      'chat-1',
      'cmsg-3',
      {},
      'u2',
    );
    expect(approved).toMatchObject({
      status: ChatMessageStatus.SENT,
      author: ChatAuthor.AGENT,
      authorUserId: 'u2',
    });
    await expect(
      service.approveSuggestion('chat-1', 'cmsg-3', {}),
    ).rejects.toThrow(ConflictException);

    expect(service.discardSuggestion('chat-2', 'cmsg-5').status).toBe(
      ChatMessageStatus.DISCARDED,
    );
    expect(service.detail('chat-2').messages).toHaveLength(1);
    expect(() => service.discardSuggestion('chat-1', 'cmsg-5')).toThrow(
      NotFoundException,
    );
  });

  it('registerInbound crea la conversación e ignora mensajes repetidos', () => {
    const first = service.registerInbound({
      channel: ChatChannel.WHATSAPP,
      externalId: '5491100000000',
      displayName: 'Nuevo',
      text: 'Hola',
      externalMessageId: 'wamid-1',
    });
    expect(first.conversation.id).toBe('chat-7');
    expect(first.message.id).toBe('cmsg-13');
    const again = service.registerInbound({
      channel: ChatChannel.WHATSAPP,
      externalId: '5491100000000',
      text: 'Hola',
      externalMessageId: 'wamid-1',
    });
    expect(again.message.id).toBe('cmsg-13');
    expect(store.chatConversations).toHaveLength(7);
    expect(recordChange).toHaveBeenCalledTimes(1);

    const second = service.registerInbound({
      channel: ChatChannel.WHATSAPP,
      externalId: '5491100000000',
      displayPhone: '+54 9 11 0000-0000',
      text: 'Sigo acá',
    });
    expect(second.conversation.displayName).toBe('Nuevo');
    expect(second.conversation.displayPhone).toBe('+54 9 11 0000-0000');
  });

  it('createSuggestion y setHandedOff', () => {
    const suggestion = service.createSuggestion('chat-4', {
      text: 'Propuesta',
    });
    expect(suggestion.status).toBe(ChatMessageStatus.SUGGESTED);
    expect(service.setHandedOff('chat-4', true).handedOff).toBe(true);
    const chat4 = service.list().conversations.find((c) => c.id === 'chat-4')!;
    expect(chat4.status).toBe(ChatStatus.HANDED_OFF);
    expect(chat4.agentPaused).toBe(true);
    expect(recordChange).toHaveBeenCalledTimes(2);
  });

  it('setAgentPaused pausa y reactiva el agente', () => {
    expect(service.setAgentPaused('chat-3', false).agentPaused).toBe(false);
    expect(service.setAgentPaused('chat-3', true).agentPaused).toBe(true);
    expect(service.setHandedOff('chat-3', false).agentPaused).toBe(true);
    expect(recordChange).toHaveBeenCalledTimes(3);
    expect(() => service.setAgentPaused('chat-99', true)).toThrow(
      NotFoundException,
    );
  });

  it('reactivar el agente saca «Te derivó»', () => {
    service.setHandedOff('chat-4', true);
    const chat = service.setAgentPaused('chat-4', false);
    expect(chat.agentPaused).toBe(false);
    expect(chat.handedOff).toBe(false);
  });

  it('sendTemplate sale fuera de la ventana, solo por WhatsApp y pausa al agente', async () => {
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { conversation } = service.registerInbound({
      channel: ChatChannel.WHATSAPP,
      externalId: '5491100000001',
      text: 'Hola',
      sentAt: old,
    });
    await expect(
      service.send(conversation.id, { text: 'Hola' }),
    ).rejects.toThrow(ConflictException);

    const template = {
      name: 'pedido_listo',
      language: 'es_AR',
      params: ['Ana', 'ord-1'],
    };
    const sent = await service.sendTemplate(
      conversation.id,
      { text: 'Hola Ana, tu pedido ord-1 está listo para retirar.', template },
      'u1',
    );
    expect(sent).toMatchObject({
      author: ChatAuthor.HUMAN,
      authorUserId: 'u1',
      status: ChatMessageStatus.SENT,
      externalMessageId: 'x1',
    });
    expect(gateway.send).toHaveBeenCalledWith(
      expect.objectContaining({ template }),
    );
    expect(store.chatConversations.at(-1)!.agentPaused).toBe(true);

    await expect(
      service.sendTemplate('chat-2', { text: 'x', template }),
    ).rejects.toThrow(BadRequestException);
  });

  it('markDeliveryFailed marca el saliente como fallido', async () => {
    const sent = await service.send('chat-1', { text: 'Hola' });
    recordChange.mockClear();
    expect(service.markDeliveryFailed('x1')).toMatchObject({
      id: sent.id,
      status: ChatMessageStatus.FAILED,
    });
    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(service.markDeliveryFailed('no-existe')).toBeNull();
  });
});
