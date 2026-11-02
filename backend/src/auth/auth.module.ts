import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Global()
@Module({
  imports: [UsersModule],
  providers: [
    FirebaseAdminService,
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
  ],
  exports: [FirebaseAdminService],
})
export class AuthModule {}
