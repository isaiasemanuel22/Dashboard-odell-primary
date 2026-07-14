import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl, parseMysqlUrl } from './db-url.util';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly client: PrismaClient | null;

  constructor() {
    const databaseUrl = getDatabaseUrl();
    this.client = databaseUrl
      ? new PrismaClient({
          adapter: new PrismaMariaDb(parseMysqlUrl(databaseUrl)),
        })
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  get prisma(): PrismaClient {
    if (!this.client) {
      throw new Error(
        'Prisma no está configurado. Definí DATABASE_URL para usar MySQL.',
      );
    }
    return this.client;
  }

  async $connect(): Promise<void> {
    if (!this.client) return;
    await this.client.$connect();
  }

  async $disconnect(): Promise<void> {
    if (!this.client) return;
    await this.client.$disconnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
