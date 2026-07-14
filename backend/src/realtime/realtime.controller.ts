import { Controller, MessageEvent, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Public } from '../auth/public.decorator';
import { SseAuthGuard } from '../auth/sse-auth.guard';
import { RealtimeService } from './realtime.service';

@Controller('events')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Public()
  @UseGuards(SseAuthGuard)
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.realtime.stream();
  }
}
