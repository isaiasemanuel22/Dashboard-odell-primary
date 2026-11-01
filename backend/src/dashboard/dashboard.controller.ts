import { Controller, Get, Query } from '@nestjs/common';
import { DashboardStatsQueryDto } from '../common/dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@Query() query: DashboardStatsQueryDto) {
    return this.dashboardService.getStats(
      query.period ?? 'month',
      query.rankBy ?? 'profit',
    );
  }
}
