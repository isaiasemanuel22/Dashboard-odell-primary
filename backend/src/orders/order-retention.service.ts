import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { StoreChangeService } from '../store/store-change.service';
import { OrdersService } from './orders.service';

const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OrderRetentionService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OrderRetentionService.name);
  private purgeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly orders: OrdersService,
    private readonly storeChange: StoreChangeService,
  ) {}

  onApplicationBootstrap(): void {
    this.runPurge('startup');
    this.purgeTimer = setInterval(
      () => this.runPurge('scheduled'),
      PURGE_INTERVAL_MS,
    );
  }

  onApplicationShutdown(): void {
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = null;
    }
  }

  private runPurge(reason: 'startup' | 'scheduled'): void {
    const purged = this.orders.purgeExpiredTerminalOrders();
    if (purged > 0) {
      this.storeChange.recordChange({
        collections: ['orders', 'printJobs'],
        realtime: {
          scopes: ['orders', 'print-jobs', 'dashboard', 'sales'],
          action: 'delete',
          entity: 'order',
        },
      });
      this.logger.log(
        `Eliminados ${purged} pedido(s) entregado(s) o cancelado(s) hace más de 1 mes (${reason})`,
      );
    }
  }
}
