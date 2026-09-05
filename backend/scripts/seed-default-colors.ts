import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl, parseMysqlUrl } from '../src/prisma/db-url.util';
import { toInputJson } from '../src/prisma/json.util';
import { DEFAULT_COLOR_CATALOG } from '../src/store/default-colors.seed';

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

    const existing = await prisma.appSettings.findUnique({ where: { id: 1 } });
    const force = process.argv.includes('--force');

    if (
      existing &&
      Array.isArray(existing.colors) &&
      (existing.colors as unknown[]).length > 0 &&
      !force
    ) {
      console.log(
        `Ya hay ${(existing.colors as unknown[]).length} colores cargados. Usá --force para reemplazar la paleta.`,
      );
      return;
    }

    const colorsJson = toInputJson(DEFAULT_COLOR_CATALOG);

    if (existing) {
      await prisma.appSettings.update({
        where: { id: 1 },
        data: { colors: colorsJson },
      });
    } else {
      await prisma.appSettings.create({
        data: {
          id: 1,
          electricityCostPerKwh: 0,
          laborCostPerHour: 0,
          profitMargins: toInputJson({
            impresion_3d: 40,
            diseno_grafico: 50,
            modelado: 50,
            estampado: 35,
          }),
          paperPricesPerSqm: toInputJson({
            sublimacion: 0,
            dtf: 0,
            dtfUv: 0,
          }),
          powerConsumptions: toInputJson([]),
          machineCosts: toInputJson([]),
          filamentPrices: toInputJson([]),
          resinPrices: toInputJson([]),
          colors: colorsJson,
        },
      });
    }

    console.log(
      `Paleta cargada: ${DEFAULT_COLOR_CATALOG.length} colores en app_settings.colors`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
