import { PrismaClient } from '@prisma/client';
import { toInputJson } from '../src/prisma/json.util';
import { createSeedState } from '../src/store/store.seed';

const prisma = new PrismaClient();

async function main() {
  const state = createSeedState();

  await prisma.appSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      electricityCostPerKwh: state.generalSettings.electricityCostPerKwh,
      laborCostPerHour: state.generalSettings.laborCostPerHour,
      profitMargins: toInputJson(state.generalSettings.profitMargins),
      paperPricesPerSqm: toInputJson(state.generalSettings.paperPricesPerSqm),
      powerConsumptions: toInputJson(state.generalSettings.powerConsumptions),
      machineCosts: toInputJson(state.generalSettings.machineCosts),
      filamentPrices: toInputJson(state.generalSettings.filamentPrices),
      resinPrices: toInputJson(state.generalSettings.resinPrices),
    },
    update: {},
  });

  for (const row of state.categories) {
    await prisma.category.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        name: row.name,
        productTypes: toInputJson(row.productTypes),
        createdAt: new Date(row.createdAt),
      },
      update: {},
    });
  }

  console.log(
    'Seed parcial completado. Al iniciar la API con DB vacía se cargan todos los datos demo.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
