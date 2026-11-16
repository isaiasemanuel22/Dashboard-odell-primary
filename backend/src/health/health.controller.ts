import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { StorePersistenceService } from '../store/store-persistence.service';

@Controller('health')
export class HealthController {
  constructor(private readonly persistence: StorePersistenceService) {}

  /** Respuesta pública: solo estado y uptime, sin detalles internos. */
  @Public()
  @Get()
  getHealth() {
    const persistenceStatus = this.persistence.getStatus();
    return {
      status: persistenceStatus.healthy ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
    };
  }
}
