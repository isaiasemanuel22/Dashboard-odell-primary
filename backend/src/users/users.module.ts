import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UserAccessBootstrapService } from './user-access.bootstrap';
import { UserAccessController } from './user-access.controller';
import { UserAccessService } from './user-access.service';

@Module({
  imports: [PrismaModule, AuthModule, AppConfigModule],
  controllers: [UserAccessController],
  providers: [UserAccessService, UserAccessBootstrapService],
  exports: [UserAccessService],
})
export class UsersModule {}
