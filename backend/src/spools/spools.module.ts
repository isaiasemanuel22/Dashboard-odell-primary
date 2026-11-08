import { Module, forwardRef } from '@nestjs/common';
import { PrintJobsModule } from '../print-jobs/print-jobs.module';
import { StoreModule } from '../store/store.module';
import { SuppliesModule } from '../supplies/supplies.module';
import { SpoolsController } from './spools.controller';
import { SpoolsService } from './spools.service';

@Module({
  imports: [
    StoreModule,
    forwardRef(() => SuppliesModule),
    forwardRef(() => PrintJobsModule),
  ],
  controllers: [SpoolsController],
  providers: [SpoolsService],
  exports: [SpoolsService],
})
export class SpoolsModule {}
