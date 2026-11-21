import { BadRequestException } from '@nestjs/common';
import { ChatsService } from '../chats/chats.service';
import { OrdersService } from '../orders/orders.service';
import { QuotesService } from '../quotes/quotes.service';
import { ChatRepository, CustomerRepository } from '../store/repositories';
import { buildSeedChats, createEmptyState } from '../store/store.seed';
import { StoreService } from '../store/store.service';
import { MetaTemplatesService } from './meta-templates.service';

describe('MetaTemplatesService', () => {
  const sendTemplate = jest.fn();
  const order = {
    id: 'ord-1',
    customerId: 'cust-5',
    customerName: 'Martina Paz',
    total: 10000,
    payments: [{ amount: 4000 }],
  };
  let service: MetaTemplatesService;

  beforeEach(() => {
    sendTemplate.mockReset().mockResolvedValue({ id: 'cmsg-99' });
    const store = new StoreService();
    store.applyState(createEmptyState());
    store.chatConversations.push(
      ...buildSeedChats(new Date()).chatConversations,
    );
    store.customers.push({ id: 'cust-5', name: 'Martina Paz' } as never);
    service = new MetaTemplatesService(
      { sendTemplate } as unknown as ChatsService,
      new ChatRepository(store),
      new CustomerRepository(store),
      { findOne: () => order } as unknown as OrdersService,
      {
        findOne: () => ({ ...order, id: 'quo-1', payments: [] }),
      } as unknown as QuotesService,
    );
  });

  it('desde el pedido usa el chat de WhatsApp del cliente y arma el saldo', async () => {
    await service.sendTemplate(
      { templateKey: 'recordatorio_saldo', orderId: 'ord-1' },
      'u1',
    );
    const [conversationId, data] = sendTemplate.mock.calls[0] as [
      string,
      { text: string; template: { name: string; params: string[] } },
    ];
    expect(conversationId).toBe('chat-1');
    expect(data.template.name).toBe('recordatorio_saldo');
    expect(data.template.params.slice(0, 2)).toEqual(['Martina Paz', 'ord-1']);
    expect(data.text).toContain('6.000');
  });

  it('sin chat de WhatsApp vinculado al cliente da 400', async () => {
    order.customerId = 'cust-9';
    await expect(
      service.sendTemplate({ templateKey: 'pedido_listo', orderId: 'ord-1' }),
    ).rejects.toThrow(
      new BadRequestException('El cliente no tiene chat de WhatsApp'),
    );
    order.customerId = 'cust-5';
  });

  it('vista previa: sin presupuesto, la plantilla de presupuesto no se puede mandar', () => {
    const previews = service.preview({ orderId: 'ord-1' });
    expect(previews.find((p) => p.key === 'presupuesto_enviado')).toMatchObject(
      {
        text: null,
        error: 'Esta plantilla necesita un presupuesto',
      },
    );
    expect(previews.find((p) => p.key === 'pedido_listo')!.text).toBe(
      'Hola Martina Paz, tu pedido ord-1 está listo para retirar.',
    );
  });
});
