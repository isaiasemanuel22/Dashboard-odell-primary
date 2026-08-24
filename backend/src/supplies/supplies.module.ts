import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';
import { PrintJobsModule } from '../print-jobs/print-jobs.module';

@Module({
  imports: [SettingsModule, PrintJobsModule],
  controllers: [SuppliesController],
  providers: [SuppliesService],
})
export class SuppliesModule {}
