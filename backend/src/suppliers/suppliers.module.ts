import { Module, forwardRef } from '@nestjs/common';
import { StoreModule } from '../store/store.module';
import { SuppliesModule } from '../supplies/supplies.module';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [StoreModule, forwardRef(() => SuppliesModule)],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
