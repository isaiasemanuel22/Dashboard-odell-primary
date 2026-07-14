import { Module } from '@nestjs/common';
import { OrderTasksService } from './order-tasks.service';
import { PrintJobsController } from './print-jobs.controller';
import { PrintJobsService } from './print-jobs.service';

@Module({
  controllers: [PrintJobsController],
  providers: [PrintJobsService, OrderTasksService],
  exports: [PrintJobsService, OrderTasksService],
})
export class PrintJobsModule {}
