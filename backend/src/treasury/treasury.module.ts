import { Module, forwardRef } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { SuppliesModule } from '../supplies/supplies.module';
import { StoreModule } from '../store/store.module';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './treasury.service';

@Module({
  imports: [StoreModule, SalesModule, forwardRef(() => SuppliesModule)],
  controllers: [TreasuryController],
  providers: [TreasuryService],
  exports: [TreasuryService],
})
export class TreasuryModule {}
