import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { SseAuthGuard } from './sse-auth.guard';

@Global()
@Module({
  providers: [
    FirebaseAdminService,
    SseAuthGuard,
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
  ],
  exports: [FirebaseAdminService, SseAuthGuard],
})
export class AuthModule {}
