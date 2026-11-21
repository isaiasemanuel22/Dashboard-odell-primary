jest.mock('../auth/firebase-admin.service', () => ({
  FirebaseAdminService: class FirebaseAdminService {},
}));

jest.mock('../users/user-access.service', () => ({
  UserAccessService: class UserAccessService {},
}));

jest.mock('../api-keys/api-keys.service', () => ({
  API_KEY_PREFIX: 'odl_live_',
  ApiKeysService: class ApiKeysService {},
}));

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AgentApprovalsService } from '../agent-approvals/agent-approvals.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ProductType } from '../common/enums';
import { AppConfigService } from '../config/app-config.service';
import { OrdersService } from '../orders/orders.service';
import { PrinterQueueService } from '../print-jobs/printer-queue.service';
import { QuotesService } from '../quotes/quotes.service';
import { DEFAULT_AGENT_TOOLS } from '../settings/agent-tools.util';
import { SettingsService } from '../settings/settings.service';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { UserAccessService } from '../users/user-access.service';
import { McpController } from './mcp.controller';
import { McpToolsService } from './mcp-tools.service';

const SECRET = 'odl_live_prueba';

interface RpcBody {
  result: {
    serverInfo?: { name: string };
    tools?: { name: string }[];
    content?: { text: string }[];
  };
}

describe('McpController (e2e con llave)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const store = new StoreService();
    const state = createEmptyState();
    state.products.push({
      id: 'prod-1',
      name: 'Pieza',
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
      printTimeHours: 1,
      workTimeHours: 0,
      stock: 3,
    });
    store.applyState(state);
    // consultar_stock solo lee el store.
    const tools = new McpToolsService(
      store,
      {} as QuotesService,
      {} as OrdersService,
      {} as PrinterQueueService,
      {} as AgentApprovalsService,
      {} as StoreChangeService,
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        { provide: McpToolsService, useValue: tools },
        {
          provide: SettingsService,
          useValue: { getAgentTools: () => DEFAULT_AGENT_TOOLS },
        },
        { provide: FirebaseAdminService, useValue: { isEnabled: () => false } },
        { provide: AppConfigService, useValue: { requireAuth: true } },
        { provide: UserAccessService, useValue: {} },
        {
          provide: ApiKeysService,
          useValue: {
            verify: (secret: string) =>
              Promise.resolve(
                secret === SECRET
                  ? { id: 'key-1', name: 'Claude', scopes: ['catalogo:leer'] }
                  : null,
              ),
          },
        },
        { provide: APP_GUARD, useClass: FirebaseAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function rpc(
    method: string,
    params: Record<string, unknown>,
    secret = SECRET,
  ) {
    return request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('X-Api-Key', secret)
      .send({ jsonrpc: '2.0', id: 1, method, params });
  }

  it('initialize + tools/list + tools/call consultar_stock', async () => {
    const init = await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'prueba', version: '1.0.0' },
    });
    expect(init.status).toBe(200);
    expect((init.body as RpcBody).result.serverInfo?.name).toBe('odell');

    const list = await rpc('tools/list', {});
    expect(list.status).toBe(200);
    const names = ((list.body as RpcBody).result.tools ?? [])
      .map((tool) => tool.name)
      .sort();
    // La llave solo tiene catalogo:leer.
    expect(names).toEqual(['consultar_stock', 'cotizar_producto']);

    const call = await rpc('tools/call', {
      name: 'consultar_stock',
      arguments: { query: 'pie' },
    });
    expect(call.status).toBe(200);
    const [content] = (call.body as RpcBody).result.content ?? [];
    expect(JSON.parse(content.text)).toEqual([
      {
        productId: 'prod-1',
        name: 'Pieza',
        price: 1000,
        stock: { physical: 3, reserved: 0, available: 3 },
      },
    ]);
  });

  it('sin llave válida responde 401', async () => {
    const res = await rpc('tools/list', {}, 'odl_live_otra');
    expect(res.status).toBe(401);
  });

  it('GET responde 405', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/mcp')
      .set('X-Api-Key', SECRET);
    expect(res.status).toBe(405);
  });
});
