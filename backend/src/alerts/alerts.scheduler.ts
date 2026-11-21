import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { toArParts } from '../common/utils/ar-date.util';
import { AppConfigService } from '../config/app-config.service';
import { AlertsService } from './alerts.service';

const TIME_ZONE = 'America/Argentina/Buenos_Aires';

@Injectable()
export class AlertsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(AlertsScheduler.name);

  constructor(
    private readonly alerts: AlertsService,
    private readonly config: AppConfigService,
  ) {}

  @Cron('0 9 * * *', { timeZone: TIME_ZONE })
  ordersDue(): Promise<void> {
    return this.run('pedidos', () => this.alerts.runOrdersDue());
  }

  @Cron('0 9 * * 1', { timeZone: TIME_ZONE })
  weeklyReceivables(): Promise<void> {
    return this.run('saldos', () => this.alerts.runWeeklyReceivables());
  }

  /** Cada 15 min de 8:00 a 20:45 (o sea, hasta las 21). */
  @Cron('*/15 8-20 * * *', { timeZone: TIME_ZONE })
  lowStock(): Promise<void> {
    return this.run('stock', () => this.alerts.runLowStock());
  }

  /** Heroku reinicia el dyno una vez por día: si ya pasaron las 9, corre lo que faltó. */
  onApplicationBootstrap(): void {
    if (this.config.nodeEnv === 'test') return;
    const now = new Date();
    const parts = toArParts(now);
    if (parts.hour < 9) return;
    void this.run('pedidos', () => this.alerts.runOrdersDue(now));
    if (parts.weekday === 1) {
      void this.run('saldos', () => this.alerts.runWeeklyReceivables(now));
    }
  }

  private async run(name: string, job: () => Promise<void>): Promise<void> {
    try {
      await job();
    } catch (error) {
      this.logger.error(
        `Aviso de ${name} falló: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
