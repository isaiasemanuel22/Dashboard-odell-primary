import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { SalesModule } from '../sales/sales.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [SalesModule, TreasuryModule, CalendarModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
