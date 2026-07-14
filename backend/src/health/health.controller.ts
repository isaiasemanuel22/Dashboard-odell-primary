import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { StorePersistenceService } from '../store/store-persistence.service';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { AppConfigService } from '../config/app-config.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly persistence: StorePersistenceService,
    private readonly firebase: FirebaseAdminService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get()
  getHealth() {
    const persistenceStatus = this.persistence.getStatus();

    return {
      status: persistenceStatus.healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: this.config.nodeEnv,
      architecture: {
        singleInstance: true,
        store: 'in-memory',
        persistence: persistenceStatus.dbEnabled ? 'mysql-snapshot' : 'none',
        note: 'El API asume una sola instancia con store en memoria como fuente de verdad.',
      },
      database: {
        enabled: persistenceStatus.dbEnabled,
        connected: persistenceStatus.dbEnabled,
      },
      persistence: {
        healthy: persistenceStatus.healthy,
        lastError: persistenceStatus.lastError,
        lastSuccessAt: persistenceStatus.lastSuccessAt,
        pending: persistenceStatus.pending,
      },
      auth: {
        enabled: this.firebase.isEnabled(),
        required: this.config.requireAuth,
      },
    };
  }
}
