import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl, parseMysqlUrl } from '../src/prisma/db-url.util';

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

    await prisma.$transaction([
      prisma.retailSaleItem.deleteMany(),
      prisma.orderItem.deleteMany(),
      prisma.printJob.deleteMany(),
      prisma.order.deleteMany(),
      prisma.retailSale.deleteMany(),
      prisma.product.deleteMany(),
      prisma.category.deleteMany(),
      prisma.customer.deleteMany(),
      prisma.supply.deleteMany(),
      prisma.impreso.deleteMany(),
      prisma.material.deleteMany(),
      prisma.appSettings.deleteMany(),
    ]);

    console.log('Base de datos vaciada correctamente.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
