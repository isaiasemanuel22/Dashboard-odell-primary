import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RealtimeController } from './realtime.controller';
import { RealtimeNotifyInterceptor } from './realtime-notify.interceptor';
import { RealtimeService } from './realtime.service';

@Module({
  controllers: [RealtimeController],
  providers: [
    RealtimeService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RealtimeNotifyInterceptor,
    },
  ],
  exports: [RealtimeService],
})
export class RealtimeModule {}
