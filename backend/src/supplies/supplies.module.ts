import { Module, forwardRef } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { PricingModule } from '../pricing/pricing.module';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';
import { PrintJobsModule } from '../print-jobs/print-jobs.module';

@Module({
  imports: [
    SettingsModule,
    PricingModule,
    forwardRef(() => PrintJobsModule),
  ],
  controllers: [SuppliesController],
  providers: [SuppliesService],
  exports: [SuppliesService],
})
export class SuppliesModule {}
