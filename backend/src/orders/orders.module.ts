import { Module } from '@nestjs/common';
import { PrintJobsModule } from '../print-jobs/print-jobs.module';
import { SettingsModule } from '../settings/settings.module';
import { OrderRetentionService } from './order-retention.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PrintJobsModule, SettingsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderRetentionService],
})
export class OrdersModule {}
