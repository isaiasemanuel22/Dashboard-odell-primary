import { Controller, Get, MessageEvent, Query, Sse } from '@nestjs/common';
import { Observable, map, merge, timer } from 'rxjs';
import { RealtimeService } from './realtime.service';
import { RealtimePing } from './realtime.types';

/** Heroku corta la conexión a los 55 s sin datos. */
export const STREAM_HEARTBEAT_MS = 25_000;

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

  /** El primer ping sale al conectar: Nest manda los headers con el primer mensaje. */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return merge(
      this.realtime.events$.pipe(map((event) => ({ data: event }))),
      timer(0, STREAM_HEARTBEAT_MS).pipe(
        map(() => {
          const ping: RealtimePing = {
            type: 'ping',
            at: new Date().toISOString(),
          };
          return { data: ping };
        }),
      ),
    );
  }
}
