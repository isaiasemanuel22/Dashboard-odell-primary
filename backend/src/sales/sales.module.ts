import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { StoreModule } from '../store/store.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [StoreModule, SettingsModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
