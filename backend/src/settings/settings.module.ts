import { forwardRef, Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { PricingModule } from '../pricing/pricing.module';
import { CostCalculatorService } from './cost-calculator.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [RealtimeModule, forwardRef(() => PricingModule)],
  controllers: [SettingsController],
  providers: [SettingsService, CostCalculatorService],
  exports: [CostCalculatorService, SettingsService],
})
export class SettingsModule {}
