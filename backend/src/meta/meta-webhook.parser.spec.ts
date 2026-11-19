import { ChatChannel } from '../common/enums';
import { parseMetaWebhook } from './meta-webhook.parser';

describe('parseMetaWebhook', () => {
  it('WhatsApp: texto con nombre del contacto, imagen con epígrafe y estados fallidos', () => {
    const result = parseMetaWebhook({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                contacts: [
                  { wa_id: '5493515550142', profile: { name: 'Martina' } },
                ],
                messages: [
                  {
                    id: 'wamid.1',
                    from: '5493515550142',
                    timestamp: '1763460000',
                    type: 'text',
                    text: { body: 'Hola' },
                  },
                  {
                    id: 'wamid.2',
                    from: '5493515550142',
                    timestamp: '1763460010',
                    type: 'image',
                    image: { caption: 'Así lo quiero' },
                  },
                ],
                statuses: [
                  { id: 'wamid.out1', status: 'delivered' },
                  { id: 'wamid.out2', status: 'failed' },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(result.inbound).toEqual([
      {
        channel: ChatChannel.WHATSAPP,
        externalId: '5493515550142',
        displayName: 'Martina',
        displayPhone: '+5493515550142',
        text: 'Hola',
        externalMessageId: 'wamid.1',
        sentAt: new Date(1763460000 * 1000).toISOString(),
      },
      expect.objectContaining({
        text: '[Imagen] Así lo quiero',
        externalMessageId: 'wamid.2',
      }),
    ]);
    expect(result.failedStatusIds).toEqual(['wamid.out2']);
  });

  it('Messenger: texto y adjunto; ignora eco, lecturas y entregas', () => {
    const result = parseMetaWebhook({
      object: 'page',
      entry: [
        {
          messaging: [
            {
              sender: { id: 'psid-1' },
              timestamp: 1763460000000,
              message: {
                mid: 'm_1',
                text: 'Precio?',
                attachments: [
                  {
                    type: 'image',
                    payload: { url: 'https://cdn.test/foto.jpg' },
                  },
                ],
              },
            },
            {
              sender: { id: 'page-1' },
              message: { mid: 'm_2', text: 'eco', is_echo: true },
            },
            { sender: { id: 'psid-1' } },
          ],
        },
      ],
    });
    expect(result.inbound).toEqual([
      {
        channel: ChatChannel.MESSENGER,
        externalId: 'psid-1',
        text: 'Precio?',
        attachments: [
          {
            id: 'm_1-0',
            name: 'Imagen',
            url: 'https://cdn.test/foto.jpg',
            mimeType: 'image/jpeg',
            size: 0,
          },
        ],
        externalMessageId: 'm_1',
        sentAt: new Date(1763460000000).toISOString(),
      },
    ]);
  });

  it('Instagram: usa el canal instagram', () => {
    const result = parseMetaWebhook({
      object: 'instagram',
      entry: [
        {
          messaging: [
            {
              sender: { id: 'igsid-1' },
              message: { mid: 'ig_1', text: 'Hola' },
            },
          ],
        },
      ],
    });
    expect(result.inbound).toHaveLength(1);
    expect(result.inbound[0]).toMatchObject({
      channel: ChatChannel.INSTAGRAM,
      externalId: 'igsid-1',
      text: 'Hola',
    });
  });

  it('otro objeto no produce nada', () => {
    expect(parseMetaWebhook({ object: 'user' })).toEqual({
      inbound: [],
      failedStatusIds: [],
    });
  });
});
