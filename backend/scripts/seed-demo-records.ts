import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl, parseMysqlUrl } from '../src/prisma/db-url.util';
import { createSeedState } from '../src/store/store.seed';
import {
  mapBrandToDb,
  mapCategoryToDb,
  mapCustomerToDb,
  mapImpresoToDb,
  mapOrderItemToDb,
  mapOrderToDbCreate,
  mapProductToDb,
  mapQuoteItemToDb,
  mapQuoteToDbCreate,
  mapRetailSaleItemToDb,
  mapRetailSaleToDb,
  mapSupplyToDb,
  mapTreasuryExpenseToDb,
} from '../src/store/mappers';
import { ADMIN_ROLE_ID } from '../src/users/user-access.bootstrap';

async function main(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está configurada en backend/.env');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(parseMysqlUrl(databaseUrl)),
  });
  const state = createSeedState();
  const created: string[] = [];

  try {
    await prisma.$connect();

    const tableRows = (await prisma.$queryRawUnsafe(
      'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()',
    )) as Array<{ name?: string; NAME?: string }>;
    const tables = new Set(
      tableRows.map((row) => (row.name ?? row.NAME ?? '').toLowerCase()),
    );
    const has = (table: string) => tables.has(table);

    if (!has('brands')) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS brands (
          id VARCHAR(64) NOT NULL,
          name VARCHAR(128) NOT NULL,
          material_types JSON NOT NULL,
          created_at DATETIME(3) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY brands_name_key (name)
        )
      `);
      tables.add('brands');
      created.push('tabla brands');
    }

    const counts = {
      brands: await prisma.brand.count(),
      categories: await prisma.category.count(),
      customers: await prisma.customer.count(),
      products: await prisma.product.count(),
      supplies: await prisma.supply.count(),
      impresos: await prisma.impreso.count(),
      orders: await prisma.order.count(),
      quotes: await prisma.quote.count(),
      sales: await prisma.retailSale.count(),
      treasury: await prisma.treasuryExpense.count(),
      printJobs: await prisma.printJob.count(),
      users: await prisma.appUser.count(),
    };
    console.log('Antes:', counts);

    for (const brand of state.brands) {
      const byId = await prisma.brand.findUnique({ where: { id: brand.id } });
      if (byId) continue;
      const byName = await prisma.brand.findUnique({ where: { name: brand.name } });
      if (byName) continue;
      await prisma.brand.create({ data: mapBrandToDb(brand) });
      created.push(`marca ${brand.name}`);
    }

    if (counts.categories === 0) {
      for (const category of state.categories) {
        await prisma.category.create({ data: mapCategoryToDb(category) });
        created.push(`categoría ${category.name}`);
      }
    }

    if (counts.supplies === 0) {
      for (const supply of state.supplies) {
        await prisma.supply.create({ data: mapSupplyToDb(supply) });
      }
      created.push(`${state.supplies.length} insumos`);
    }

    if (counts.impresos === 0) {
      for (const impreso of state.impresos) {
        await prisma.impreso.create({ data: mapImpresoToDb(impreso) });
      }
      created.push(`${state.impresos.length} impresos`);
    }

    if (counts.products === 0) {
      for (const product of state.products) {
        await prisma.product.create({ data: mapProductToDb(product) });
      }
      created.push(`${state.products.length} productos`);
    }

    async function ensureCustomer(
      customerId: string | null,
      customerName: string,
    ): Promise<string | null> {
      if (customerId) {
        const byId = await prisma.customer.findUnique({ where: { id: customerId } });
        if (byId) return byId.id;
      }
      const byName = await prisma.customer.findFirst({
        where: { name: customerName },
      });
      if (byName) return byName.id;

      const seed = state.customers.find(
        (customer) =>
          customer.id === customerId || customer.name === customerName,
      );
      if (!seed) return null;
      await prisma.customer.create({ data: mapCustomerToDb(seed) });
      created.push(`cliente ${seed.name}`);
      return seed.id;
    }

    if (counts.customers === 0) {
      for (const customer of state.customers) {
        const existing = await prisma.customer.findUnique({
          where: { id: customer.id },
        });
        if (existing) continue;
        await prisma.customer.create({ data: mapCustomerToDb(customer) });
      }
      created.push(`${state.customers.length} clientes`);
    }

    if (counts.orders === 0) {
      for (const order of state.orders) {
        const customerId = await ensureCustomer(
          order.customerId,
          order.customerName,
        );
        await prisma.order.create({
          data: mapOrderToDbCreate({ ...order, customerId }),
        });
        for (const [index, item] of order.items.entries()) {
          await prisma.orderItem.create({
            data: mapOrderItemToDb(order.id, index, item),
          });
        }
      }
      created.push(`${state.orders.length} pedidos`);
    }

    for (const quote of state.quotes) {
      const existing = await prisma.quote.findUnique({ where: { id: quote.id } });
      if (existing) continue;
      const customerId = await ensureCustomer(
        quote.customerId,
        quote.customerName,
      );
      await prisma.quote.create({
        data: mapQuoteToDbCreate({ ...quote, customerId }),
      });
      for (const [index, item] of quote.items.entries()) {
        await prisma.quoteItem.create({
          data: mapQuoteItemToDb(quote.id, index, item),
        });
      }
      created.push(`presupuesto ${quote.id}`);
    }

    for (const sale of state.retailSales) {
      const existing = await prisma.retailSale.findUnique({
        where: { id: sale.id },
      });
      if (existing) continue;
      await prisma.retailSale.create({ data: mapRetailSaleToDb(sale) });
      for (const [index, item] of sale.items.entries()) {
        await prisma.retailSaleItem.create({
          data: mapRetailSaleItemToDb(sale.id, index, item),
        });
      }
      created.push(`venta ${sale.id}`);
    }

    for (const movement of state.treasuryExpenses) {
      const existing = await prisma.treasuryExpense.findUnique({
        where: { id: movement.id },
      });
      if (existing) continue;
      await prisma.treasuryExpense.create({
        data: mapTreasuryExpenseToDb(movement),
      });
      created.push(`movimiento ${movement.name}`);
    }

    if (counts.users === 0) {
      const now = new Date();
      const role = await prisma.appRole.findUnique({
        where: { id: ADMIN_ROLE_ID },
      });
      const demoUsers = [
        {
          id: 'user-ana',
          email: 'ana.lopez@odell.local',
          displayName: 'Ana López',
        },
        {
          id: 'user-martin',
          email: 'martin.perez@odell.local',
          displayName: 'Martín Pérez',
        },
      ];
      for (const user of demoUsers) {
        await prisma.appUser.create({
          data: {
            ...user,
            active: true,
            createdAt: now,
            updatedAt: now,
            ...(role
              ? { userRoles: { create: { roleId: role.id } } }
              : {}),
          },
        });
        created.push(`usuario ${user.displayName}`);
      }
    }

    console.log(
      created.length
        ? `Creados:\n- ${created.join('\n- ')}`
        : 'No había registros faltantes.',
    );
    console.log(
      'La cola de trabajo se arma al reiniciar el API a partir de los pedidos.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
