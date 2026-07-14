import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { CostCalculatorService } from './cost-calculator.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [RealtimeModule],
  controllers: [SettingsController],
  providers: [SettingsService, CostCalculatorService],
  exports: [CostCalculatorService, SettingsService],
})
export class SettingsModule {}
