import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiKey as DbApiKey } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { fromJson, toInputJson } from '../prisma/json.util';
import { PrismaService } from '../prisma/prisma.service';
import { API_KEY_SCOPES, ApiKeyPrincipal, ApiKeyScope } from './api-key-scopes';

export const API_KEY_PREFIX = 'odl_live_';

export interface ApiKeyView {
  id: string;
  name: string;
  displayPrefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function toView(row: DbApiKey): ApiKeyView {
  return {
    id: row.id,
    name: row.name,
    displayPrefix: `${API_KEY_PREFIX}••••${row.lastFour}`,
    scopes: fromJson<ApiKeyScope[]>(row.scopes),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ApiKeysService {
  private static readonly CACHE_TTL_MS = 60_000;
  private static readonly LAST_USED_INTERVAL_MS = 5 * 60_000;

  private readonly logger = new Logger(ApiKeysService.name);
  private readonly cache = new Map<
    string,
    { principal: ApiKeyPrincipal; expiresAt: number }
  >();
  private readonly lastUsedWrites = new Map<string, number>();

  constructor(private readonly prismaService: PrismaService) {}

  private db() {
    if (!this.prismaService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Las llaves de acceso requieren DATABASE_URL configurada',
      );
    }
    return this.prismaService.prisma;
  }

  async list(): Promise<ApiKeyView[]> {
    const rows = await this.db().apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toView);
  }

  async create(
    name: string,
    scopes: string[],
    actorId?: string,
  ): Promise<{ apiKey: ApiKeyView; secret: string }> {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new BadRequestException('El nombre de la llave es obligatorio');
    }
    if (
      scopes.length === 0 ||
      scopes.some((scope) => !API_KEY_SCOPES.includes(scope as ApiKeyScope))
    ) {
      throw new BadRequestException('Permisos de la llave inválidos');
    }

    const secret = `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
    const row = await this.db().apiKey.create({
      data: {
        id: `key-${randomUUID()}`,
        name: cleanName,
        lastFour: secret.slice(-4),
        secretHash: hashSecret(secret),
        scopes: toInputJson([...new Set(scopes)]),
        createdByUserId: actorId ?? null,
        createdAt: new Date(),
      },
    });
    return { apiKey: toView(row), secret };
  }

  async revoke(id: string): Promise<ApiKeyView> {
    const current = await this.db().apiKey.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException(`Llave ${id} no encontrada`);
    }
    const row = current.revokedAt
      ? current
      : await this.db().apiKey.update({
          where: { id },
          data: { revokedAt: new Date() },
        });
    this.cache.clear();
    return toView(row);
  }

  /** Devuelve la llave si el secreto es válido y no está revocada. */
  async verify(secret: string): Promise<ApiKeyPrincipal | null> {
    if (!secret.startsWith(API_KEY_PREFIX)) return null;
    const hash = hashSecret(secret);

    const cached = this.cache.get(hash);
    if (cached && Date.now() <= cached.expiresAt) {
      this.touchLastUsed(cached.principal.id);
      return cached.principal;
    }
    this.cache.delete(hash);

    const row = await this.db().apiKey.findUnique({
      where: { secretHash: hash },
    });
    if (!row || row.revokedAt) return null;

    const principal: ApiKeyPrincipal = {
      id: row.id,
      name: row.name,
      scopes: fromJson<ApiKeyScope[]>(row.scopes),
    };
    this.cache.set(hash, {
      principal,
      expiresAt: Date.now() + ApiKeysService.CACHE_TTL_MS,
    });
    this.touchLastUsed(row.id, row.lastUsedAt);
    return principal;
  }

  /** Guarda el último uso cada 5 min como mucho, sin frenar la request. */
  private touchLastUsed(id: string, lastUsedAt?: Date | null): void {
    const now = Date.now();
    const last = this.lastUsedWrites.get(id) ?? lastUsedAt?.getTime() ?? 0;
    if (now - last < ApiKeysService.LAST_USED_INTERVAL_MS) return;
    this.lastUsedWrites.set(id, now);
    this.db()
      .apiKey.update({ where: { id }, data: { lastUsedAt: new Date(now) } })
      .catch((error: unknown) => {
        this.logger.warn(
          `No se pudo guardar el último uso de ${id}: ${String(error)}`,
        );
      });
  }
}
