import { Module, forwardRef } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { SpoolsModule } from '../spools/spools.module';
import { OrderTasksService } from './order-tasks.service';
import { PrintJobsController } from './print-jobs.controller';
import { PrintJobsService } from './print-jobs.service';
import { PrinterQueueService } from './printer-queue.service';

@Module({
  imports: [SettingsModule, forwardRef(() => SpoolsModule)],
  controllers: [PrintJobsController],
  providers: [PrintJobsService, OrderTasksService, PrinterQueueService],
  exports: [PrintJobsService, OrderTasksService, PrinterQueueService],
})
export class PrintJobsModule {}
