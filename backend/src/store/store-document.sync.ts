import { Prisma } from '@prisma/client';
import { GeneralSettings, Order, Quote, RetailSale } from '../common/interfaces';
import {
  mapOrderItemToDb,
  mapOrderToDbCreate,
  mapOrderToDbUpdate,
  mapQuoteItemToDb,
  mapQuoteToDbCreate,
  mapQuoteToDbUpdate,
  mapRetailSaleItemToDb,
  mapRetailSaleToDb,
  mapSettingsToDb,
} from './mappers';

export async function syncSettings(
  tx: Prisma.TransactionClient,
  settings: GeneralSettings,
): Promise<void> {
  const data = mapSettingsToDb(settings);
  await tx.appSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
}

export async function syncOrders(
  tx: Prisma.TransactionClient,
  orders: Order[],
): Promise<void> {
  const orderIds = orders.map((order) => order.id);
  await tx.orderItem.deleteMany({
    where: { orderId: { notIn: orderIds.length ? orderIds : ['__none__'] } },
  });
  await tx.order.deleteMany({
    where: { id: { notIn: orderIds.length ? orderIds : ['__none__'] } },
  });

  for (const order of orders) {
    await tx.order.upsert({
      where: { id: order.id },
      create: mapOrderToDbCreate(order),
      update: mapOrderToDbUpdate(order),
    });

    await tx.orderItem.deleteMany({ where: { orderId: order.id } });
    for (const [index, item] of order.items.entries()) {
      await tx.orderItem.create({
        data: mapOrderItemToDb(order.id, index, item),
      });
    }
  }
}

export async function syncQuotes(
  tx: Prisma.TransactionClient,
  quotes: Quote[],
): Promise<void> {
  const quoteIds = quotes.map((quote) => quote.id);
  await tx.quoteItem.deleteMany({
    where: { quoteId: { notIn: quoteIds.length ? quoteIds : ['__none__'] } },
  });
  await tx.quote.deleteMany({
    where: { id: { notIn: quoteIds.length ? quoteIds : ['__none__'] } },
  });

  for (const quote of quotes) {
    await tx.quote.upsert({
      where: { id: quote.id },
      create: mapQuoteToDbCreate(quote),
      update: mapQuoteToDbUpdate(quote),
    });

    await tx.quoteItem.deleteMany({ where: { quoteId: quote.id } });
    for (const [index, item] of quote.items.entries()) {
      await tx.quoteItem.create({
        data: mapQuoteItemToDb(quote.id, index, item),
      });
    }
  }
}

export async function syncRetailSales(
  tx: Prisma.TransactionClient,
  sales: RetailSale[],
): Promise<void> {
  const saleIds = sales.map((sale) => sale.id);
  await tx.retailSaleItem.deleteMany({
    where: {
      retailSaleId: { notIn: saleIds.length ? saleIds : ['__none__'] },
    },
  });
  await tx.retailSale.deleteMany({
    where: { id: { notIn: saleIds.length ? saleIds : ['__none__'] } },
  });

  for (const sale of sales) {
    await tx.retailSale.upsert({
      where: { id: sale.id },
      create: mapRetailSaleToDb(sale),
      update: mapRetailSaleToDb(sale),
    });

    await tx.retailSaleItem.deleteMany({ where: { retailSaleId: sale.id } });
    for (const [index, item] of sale.items.entries()) {
      await tx.retailSaleItem.create({
        data: mapRetailSaleItemToDb(sale.id, index, item),
      });
    }
  }
}

export async function syncCollection<T extends { id: string }>(
  tx: Prisma.TransactionClient,
  rows: T[],
  deleteOrphans: (ids: string[]) => Promise<unknown>,
  upsert: (row: T) => Promise<unknown>,
): Promise<void> {
  const ids = rows.map((row) => row.id);
  await deleteOrphans(ids.length ? ids : ['__none__']);

  for (const row of rows) {
    await upsert(row);
  }
}
