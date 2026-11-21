import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService', () => {
  let rows: Record<string, unknown>[];
  let service: ApiKeysService;

  beforeEach(() => {
    rows = [];
    const prisma = {
      apiKey: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          const row = { lastUsedAt: null, revokedAt: null, ...data };
          rows.push(row);
          return Promise.resolve(row);
        }),
        findUnique: jest.fn(
          ({ where }: { where: { id?: string; secretHash?: string } }) =>
            Promise.resolve(
              rows.find(
                (row) =>
                  (where.id && row.id === where.id) ||
                  (where.secretHash && row.secretHash === where.secretHash),
              ) ?? null,
            ),
        ),
        update: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            const row = rows.find((item) => item.id === where.id)!;
            Object.assign(row, data);
            return Promise.resolve(row);
          },
        ),
      },
    };
    service = new ApiKeysService({
      isConfigured: () => true,
      prisma,
    } as unknown as PrismaService);
  });

  it('crea el secreto con prefijo odl_live_ y guarda solo el hash', async () => {
    const { apiKey, secret } = await service.create('Bot', ['catalogo:leer']);

    expect(secret.startsWith('odl_live_')).toBe(true);
    expect(apiKey.displayPrefix).toBe(`odl_live_••••${secret.slice(-4)}`);
    expect(rows[0].secretHash).toBe(
      createHash('sha256').update(secret).digest('hex'),
    );
    expect(JSON.stringify(rows[0])).not.toContain(secret);
    expect(JSON.stringify(apiKey)).not.toContain(secret);
  });

  it('verify devuelve la llave y null una vez revocada', async () => {
    const { apiKey, secret } = await service.create('Bot', ['cola:leer']);

    await expect(service.verify(secret)).resolves.toEqual({
      id: apiKey.id,
      name: 'Bot',
      scopes: ['cola:leer'],
    });
    await service.revoke(apiKey.id);
    await expect(service.verify(secret)).resolves.toBeNull();
    await expect(service.verify('odl_live_otra')).resolves.toBeNull();
  });

  it('rechaza permisos inválidos o vacíos', async () => {
    await expect(service.create('Bot', ['borrar:todo'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create('Bot', [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
