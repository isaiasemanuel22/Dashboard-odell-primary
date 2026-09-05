import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [SalesModule, TreasuryModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
