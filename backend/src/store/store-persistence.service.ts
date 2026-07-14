import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import {
  ALL_STORE_COLLECTIONS,
  StoreCollection,
} from './store.collections';
import { Prisma } from '@prisma/client';
import { GeneralSettings, Order, PrintJob, RetailSale } from '../common/interfaces';
import { PrismaService } from '../prisma/prisma.service';
import {
  mapCategoryFromDb,
  mapCategoryToDb,
  mapCustomerFromDb,
  mapCustomerToDb,
  mapImpresoFromDb,
  mapImpresoToDb,
  mapMaterialFromDb,
  mapMaterialToDb,
  mapOrderFromDb,
  mapOrderItemToDb,
  mapOrderToDb,
  mapPrintJobFromDb,
  mapPrintJobToDb,
  mapProductFromDb,
  mapProductToDb,
  mapRetailSaleFromDb,
  mapRetailSaleItemToDb,
  mapRetailSaleToDb,
  mapSettingsFromDb,
  mapSettingsToDb,
  mapSupplyFromDb,
  mapSupplyToDb,
} from './mappers';
import { createEmptyState, createSeedState } from './store.seed';
import { StoreService } from './store.service';
import { StoreState } from './store.state';

export interface PersistenceStatus {
  dbEnabled: boolean;
  healthy: boolean;
  lastError: string | null;
  lastSuccessAt: string | null;
  pending: boolean;
}

@Injectable()
export class StorePersistenceService
  implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(StorePersistenceService.name);
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private dbEnabled = false;
  private persistQueued = false;
  private healthy = true;
  private lastError: string | null = null;
  private lastSuccessAt: string | null = null;
  private readonly dirtyCollections = new Set<StoreCollection>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly store: StoreService,
    private readonly config: AppConfigService,
  ) {}

  private get db() {
    return this.prismaService.prisma;
  }

  async onModuleInit(): Promise<void> {
    const databaseUrl = this.config.databaseUrl;
    if (!databaseUrl) {
      if (this.config.requireDatabase) {
        throw new Error('DATABASE_URL es obligatoria');
      }
      this.store.applySeed();
      this.logger.warn(
        'DATABASE_URL no configurada. Usando datos en memoria (no persisten).',
      );
      return;
    }

    try {
      await this.prismaService.$connect();
      this.dbEnabled = true;

      if (await this.isEmptyDatabase()) {
        if (this.config.autoSeed) {
          this.logger.log('Base de datos vacía: cargando datos iniciales…');
          this.store.applySeed();
          await this.persistNow(ALL_STORE_COLLECTIONS);
          this.logger.log('Datos iniciales guardados en MySQL');
        } else {
          this.store.applyState(createEmptyState());
          this.logger.log('Base de datos vacía. Arrancando sin datos de demo.');
        }
        return;
      }

      const state = await this.loadState();
      this.store.applyState(state);
      this.logger.log('Datos cargados desde MySQL');
    } catch (error) {
      this.dbEnabled = false;
      this.markUnhealthy(this.errorMessage(error));

      if (this.config.requireDatabase) {
        throw error;
      }

      this.store.applySeed();
      this.logger.warn(
        `MySQL no disponible (${this.errorMessage(error)}). Usando datos en memoria.`,
      );
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.dbEnabled) return;
    await this.persistNow(ALL_STORE_COLLECTIONS);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }

    if (!this.dbEnabled || !this.persistQueued) return;

    this.persistQueued = false;
    const collections = this.dirtyCollections.size
      ? [...this.dirtyCollections]
      : ALL_STORE_COLLECTIONS;
    await this.persistNow(collections);
  }

  getStatus(): PersistenceStatus {
    return {
      dbEnabled: this.dbEnabled,
      healthy: this.healthy,
      lastError: this.lastError,
      lastSuccessAt: this.lastSuccessAt,
      pending: this.persistQueued,
    };
  }

  /** Borra todos los registros en memoria/DB y deja el store vacío. */
  async clearDatabase(): Promise<void> {
    this.store.applyState(createEmptyState());

    if (!this.dbEnabled) {
      this.logger.warn(
        'Base vaciada en memoria (MySQL no disponible).',
      );
      return;
    }

    await this.persistNow(ALL_STORE_COLLECTIONS);
    this.logger.log('Base de datos vaciada.');
  }

  schedulePersist(collections?: StoreCollection[]): void {
    if (!this.dbEnabled) return;

    const target = collections?.length ? collections : ALL_STORE_COLLECTIONS;
    for (const collection of target) {
      this.dirtyCollections.add(collection);
    }

    this.persistQueued = true;
    if (this.persistTimer) return;

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.flushPersistQueue();
    }, 400);
  }

  private async flushPersistQueue(): Promise<void> {
    if (!this.persistQueued) return;
    this.persistQueued = false;

    const collections = this.dirtyCollections.size
      ? [...this.dirtyCollections]
      : ALL_STORE_COLLECTIONS;
    this.dirtyCollections.clear();
    await this.persistNow(collections);
  }

  private async persistNow(collections: StoreCollection[]): Promise<void> {
    if (!this.dbEnabled) return;

    try {
      await this.saveStatePartial(this.store.toState(), collections);
      this.healthy = true;
      this.lastError = null;
      this.lastSuccessAt = new Date().toISOString();
    } catch (error) {
      const message = this.errorMessage(error);
      this.markUnhealthy(message);
      this.logger.error(`Error al guardar en MySQL: ${message}`);
    }
  }

  private markUnhealthy(message: string): void {
    this.healthy = false;
    this.lastError = message;
  }

  private async isEmptyDatabase(): Promise<boolean> {
    const count = await this.db.category.count();
    return count === 0;
  }

  private async loadState(): Promise<StoreState> {
    const [
      settingsRow,
      categories,
      customers,
      products,
      supplies,
      impresos,
      materials,
      orders,
      printJobs,
      retailSales,
    ] = await Promise.all([
      this.db.appSettings.findUnique({ where: { id: 1 } }),
      this.db.category.findMany(),
      this.db.customer.findMany(),
      this.db.product.findMany(),
      this.db.supply.findMany(),
      this.db.impreso.findMany(),
      this.db.material.findMany(),
      this.db.order.findMany({
        include: { items: { orderBy: { sortIndex: 'asc' } } },
      }),
      this.db.printJob.findMany(),
      this.db.retailSale.findMany({
        include: { items: { orderBy: { sortIndex: 'asc' } } },
      }),
    ]);

    if (!settingsRow) {
      return createSeedState();
    }

    return {
      generalSettings: mapSettingsFromDb(settingsRow),
      categories: categories.map((row) => mapCategoryFromDb(row)),
      customers: customers.map((row) => mapCustomerFromDb(row)),
      products: products.map((row) => mapProductFromDb(row)),
      supplies: supplies.map((row) => mapSupplyFromDb(row)),
      impresos: impresos.map((row) => mapImpresoFromDb(row)),
      materials: materials.map((row) => mapMaterialFromDb(row)),
      orders: orders.map((row) => mapOrderFromDb(row)),
      printJobs: printJobs.map((row) => mapPrintJobFromDb(row)),
      retailSales: retailSales.map((row) => mapRetailSaleFromDb(row)),
    };
  }

  private async saveStatePartial(
    state: StoreState,
    collections: StoreCollection[],
  ): Promise<void> {
    const dirty = new Set(collections);

    await this.db.$transaction(async (tx) => {
      if (dirty.has('settings')) {
        await this.syncSettings(tx, state.generalSettings);
      }
      if (dirty.has('categories')) {
        await this.syncCollection(
          tx,
          state.categories,
          (ids) => tx.category.deleteMany({ where: { id: { notIn: ids } } }),
          (row) =>
            tx.category.upsert({
              where: { id: row.id },
              create: mapCategoryToDb(row),
              update: mapCategoryToDb(row),
            }),
        );
      }
      if (dirty.has('customers')) {
        await this.syncCollection(
          tx,
          state.customers,
          (ids) => tx.customer.deleteMany({ where: { id: { notIn: ids } } }),
          (row) =>
            tx.customer.upsert({
              where: { id: row.id },
              create: mapCustomerToDb(row),
              update: mapCustomerToDb(row),
            }),
        );
      }
      if (dirty.has('products')) {
        await this.syncCollection(
          tx,
          state.products,
          (ids) => tx.product.deleteMany({ where: { id: { notIn: ids } } }),
          (row) =>
            tx.product.upsert({
              where: { id: row.id },
              create: mapProductToDb(row),
              update: mapProductToDb(row),
            }),
        );
      }
      if (dirty.has('supplies')) {
        await this.syncCollection(
          tx,
          state.supplies,
          (ids) => tx.supply.deleteMany({ where: { id: { notIn: ids } } }),
          (row) =>
            tx.supply.upsert({
              where: { id: row.id },
              create: mapSupplyToDb(row),
              update: mapSupplyToDb(row),
            }),
        );
      }
      if (dirty.has('impresos')) {
        await this.syncCollection(
          tx,
          state.impresos,
          (ids) => tx.impreso.deleteMany({ where: { id: { notIn: ids } } }),
          (row) =>
            tx.impreso.upsert({
              where: { id: row.id },
              create: mapImpresoToDb(row),
              update: mapImpresoToDb(row),
            }),
        );
      }
      if (dirty.has('materials')) {
        await this.syncCollection(
          tx,
          state.materials,
          (ids) => tx.material.deleteMany({ where: { id: { notIn: ids } } }),
          (row) =>
            tx.material.upsert({
              where: { id: row.id },
              create: mapMaterialToDb(row),
              update: mapMaterialToDb(row),
            }),
        );
      }
      if (dirty.has('orders')) {
        await this.syncOrders(tx, state.orders);
      }
      if (dirty.has('printJobs')) {
        await this.syncCollection(
          tx,
          state.printJobs,
          (ids) => tx.printJob.deleteMany({ where: { id: { notIn: ids } } }),
          (row) =>
            tx.printJob.upsert({
              where: { id: row.id },
              create: mapPrintJobToDb(row),
              update: mapPrintJobToDb(row),
            }),
        );
      }
      if (dirty.has('retailSales')) {
        await this.syncRetailSales(tx, state.retailSales);
      }
    });
  }

  private async syncSettings(
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

  private async syncOrders(
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
        create: mapOrderToDb(order),
        update: mapOrderToDb(order),
      });

      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      for (const [index, item] of order.items.entries()) {
        await tx.orderItem.create({
          data: mapOrderItemToDb(order.id, index, item),
        });
      }
    }
  }

  private async syncRetailSales(
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

  private async syncCollection<T extends { id: string }>(
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

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
