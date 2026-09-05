import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl, parseMysqlUrl } from '../src/prisma/db-url.util';

async function columnExists(
  prisma: PrismaClient,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
      AND COLUMN_NAME = ${column}
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function main(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está configurada en backend/.env');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(parseMysqlUrl(databaseUrl)),
  });

  try {
    await prisma.$connect();

    const hasTypeColumn = await columnExists(prisma, 'supplies', 'type');
    if (!hasTypeColumn) {
      console.log('La columna supplies.type ya no existe. Nada que hacer.');
      return;
    }

    await prisma.$executeRawUnsafe('ALTER TABLE `supplies` DROP COLUMN `type`');
    console.log('Columna supplies.type eliminada correctamente.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
