import { createHmac } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ChatsService } from '../chats/chats.service';
import { AppConfigService } from '../config/app-config.service';
import { MetaInboundEvents } from './meta-inbound.events';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './meta-webhook.service';

const SECRET = 'secreto-de-prueba';

describe('MetaWebhookController', () => {
  let app: INestApplication<App>;
  const registerInbound = jest.fn();
  const markDeliveryFailed = jest.fn();
  const events = new MetaInboundEvents();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MetaWebhookController],
      providers: [
        MetaWebhookService,
        { provide: MetaInboundEvents, useValue: events },
        {
          provide: AppConfigService,
          useValue: {
            metaVerifyToken: 'token-verificacion',
            metaAppSecret: SECRET,
            isProduction: true,
          },
        },
        {
          provide: ChatsService,
          useValue: { registerInbound, markDeliveryFailed },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(() => app.close());

  it('verificación: devuelve el challenge en texto plano', async () => {
    const res = await request(app.getHttpServer())
      .get('/meta/webhook')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'token-verificacion',
        'hub.challenge': '12345',
      })
      .expect(200);
    expect(res.text).toBe('12345');
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('verificación con otro token da 403', async () => {
    await request(app.getHttpServer())
      .get('/meta/webhook')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'otro',
        'hub.challenge': '12345',
      })
      .expect(403);
  });

  it('firma inválida da 401 y no guarda nada', async () => {
    await request(app.getHttpServer())
      .post('/meta/webhook')
      .set('X-Hub-Signature-256', 'sha256=00')
      .send({ object: 'page', entry: [] })
      .expect(401);
    expect(registerInbound).not.toHaveBeenCalled();
  });

  it('firmado: responde 200, guarda el entrante y lo emite', async () => {
    registerInbound.mockReturnValue({
      conversation: {
        id: 'chat-7',
        channel: 'messenger',
        externalId: 'psid-1',
      },
      message: { id: 'cmsg-20' },
    });
    const emitted: unknown[] = [];
    const subscription = events.inbound$.subscribe((e) => emitted.push(e));
    const body = JSON.stringify({
      object: 'page',
      entry: [
        {
          messaging: [
            { sender: { id: 'psid-1' }, message: { mid: 'm1', text: 'Hola' } },
          ],
        },
      ],
    });
    const signature = `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
    const res = await request(app.getHttpServer())
      .post('/meta/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .send(body)
      .expect(200);
    subscription.unsubscribe();
    expect(res.body).toEqual({ ok: true });
    expect(registerInbound).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'psid-1', text: 'Hola' }),
    );
    expect(emitted).toEqual([
      {
        conversationId: 'chat-7',
        messageId: 'cmsg-20',
        channel: 'messenger',
        externalId: 'psid-1',
      },
    ]);
  });
});
