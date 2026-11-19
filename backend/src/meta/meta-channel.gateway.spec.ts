import { ChatChannel } from '../common/enums';
import { ChatConversation, ChatMessage } from '../common/interfaces';
import { AppConfigService } from '../config/app-config.service';
import { MetaChannelGateway } from './meta-channel.gateway';
import { MetaGraphClient } from './meta-graph.client';

describe('MetaChannelGateway', () => {
  const fetchMock = jest.fn();
  const config = {
    whatsappConfigured: true,
    pageConfigured: false,
    whatsappPhoneNumberId: 'phone-1',
    metaAccessToken: 'wa-token',
  } as AppConfigService;
  const gateway = new MetaChannelGateway(new MetaGraphClient(config), config);

  const conversation = (channel: ChatChannel) =>
    ({
      id: 'chat-1',
      channel,
      externalId: '5493515550142',
    }) as ChatConversation;
  const message = {
    text: 'Hola',
    attachments: [
      {
        id: 'a1',
        name: 'foto.jpg',
        url: 'https://cdn.test/foto.jpg',
        mimeType: 'image/jpeg',
        size: 10,
      },
      {
        id: 'a2',
        name: 'local.pdf',
        url: '/uploads/local.pdf',
        mimeType: 'application/pdf',
        size: 10,
      },
    ],
  } as ChatMessage;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wamid.out' }] }),
    });
    global.fetch = fetchMock;
  });

  const sentBodies = () =>
    fetchMock.mock.calls.map(
      ([, init]: [string, { body: string }]) =>
        JSON.parse(init.body) as Record<string, unknown>,
    );

  it('WhatsApp: texto y solo los adjuntos con URL pública', async () => {
    const result = await gateway.send({
      conversation: conversation(ChatChannel.WHATSAPP),
      message,
    });
    expect(result.externalMessageId).toBe('wamid.out');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v27.0/phone-1/messages',
      expect.anything(),
    );
    expect(sentBodies()).toEqual([
      {
        messaging_product: 'whatsapp',
        to: '5493515550142',
        type: 'text',
        text: { body: 'Hola' },
      },
      {
        messaging_product: 'whatsapp',
        to: '5493515550142',
        type: 'image',
        image: { link: 'https://cdn.test/foto.jpg' },
      },
    ]);
  });

  it('WhatsApp con plantilla manda solo la plantilla', async () => {
    await gateway.send({
      conversation: conversation(ChatChannel.WHATSAPP),
      message,
      template: {
        name: 'pedido_listo',
        language: 'es_AR',
        params: ['Martina', 'ord-1'],
      },
    });
    expect(sentBodies()).toEqual([
      {
        messaging_product: 'whatsapp',
        to: '5493515550142',
        type: 'template',
        template: {
          name: 'pedido_listo',
          language: { code: 'es_AR' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Martina' },
                { type: 'text', text: 'ord-1' },
              ],
            },
          ],
        },
      },
    ]);
  });

  it('canal sin credenciales no llama a Meta', async () => {
    const result = await gateway.send({
      conversation: conversation(ChatChannel.INSTAGRAM),
      message,
    });
    expect(result).toEqual({ externalMessageId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('si Meta responde error, tira con el mensaje de Graph', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({ error: { message: 'Re-engagement message' } }),
    });
    await expect(
      gateway.send({
        conversation: conversation(ChatChannel.WHATSAPP),
        message: { ...message, attachments: [] },
      }),
    ).rejects.toThrow('Re-engagement message');
  });
});
