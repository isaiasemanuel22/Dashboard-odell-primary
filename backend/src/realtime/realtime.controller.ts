import { Controller, Get, Query } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

@Controller('events')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Get('poll')
  poll(@Query('since') since?: string) {
    return {
      events: this.realtime.getEventsSince(since),
      serverTime: new Date().toISOString(),
    };
  }
}
