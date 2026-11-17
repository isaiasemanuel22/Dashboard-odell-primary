import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { StoreModule } from '../store/store.module';
import { FairsController } from './fairs.controller';
import { FairsService } from './fairs.service';

@Module({
  imports: [StoreModule, SalesModule],
  controllers: [FairsController],
  providers: [FairsService],
  exports: [FairsService],
})
export class FairsModule {}
