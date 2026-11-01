import { IsEnum, IsOptional } from 'class-validator';

export enum DashboardStatsPeriod {
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

export enum DashboardRankBy {
  PROFIT = 'profit',
  MARKUP = 'markup',
  UNITS = 'units',
}

export class DashboardStatsQueryDto {
  @IsOptional()
  @IsEnum(DashboardStatsPeriod)
  period?: DashboardStatsPeriod;

  @IsOptional()
  @IsEnum(DashboardRankBy)
  rankBy?: DashboardRankBy;
}
