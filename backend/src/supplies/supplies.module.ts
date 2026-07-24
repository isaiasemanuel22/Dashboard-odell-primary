import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { PricingModule } from '../pricing/pricing.module';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';

@Module({
  imports: [SettingsModule, PricingModule],
  controllers: [SuppliesController],
  providers: [SuppliesService],
})
export class SuppliesModule {}
