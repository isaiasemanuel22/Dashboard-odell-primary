import { Module, forwardRef } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { PricingModule } from '../pricing/pricing.module';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';
import { SuppliesReorderService } from './supplies-reorder.service';
import { PrintJobsModule } from '../print-jobs/print-jobs.module';
import { SpoolsModule } from '../spools/spools.module';

@Module({
  imports: [
    SettingsModule,
    PricingModule,
    forwardRef(() => PrintJobsModule),
    forwardRef(() => SpoolsModule),
  ],
  controllers: [SuppliesController],
  providers: [SuppliesService, SuppliesReorderService],
  exports: [SuppliesService, SuppliesReorderService],
})
export class SuppliesModule {}
