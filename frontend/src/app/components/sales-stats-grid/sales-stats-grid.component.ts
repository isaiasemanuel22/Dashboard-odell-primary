import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SalesStats } from '../../core/models';
import {
  SaleStatBreakdownRow,
  SaleStatCardComponent,
} from '../sale-stat-card/sale-stat-card.component';
import { AreaProfitBalanceComponent } from '../area-profit-balance/area-profit-balance.component';

@Component({
  selector: 'app-sales-stats-grid',
  standalone: true,
  imports: [SaleStatCardComponent, AreaProfitBalanceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-stats-grid.component.html',
  styleUrl: './sales-stats-grid.component.scss',
})
export class SalesStatsGridComponent {
  @Input({ required: true }) stats!: SalesStats;

  get revenueBreakdown(): SaleStatBreakdownRow[] {
    return this.sourceBreakdown(
      this.stats.monthlyRetailRevenue,
      this.stats.monthlyOrdersRevenue,
    );
  }

  get costBreakdown(): SaleStatBreakdownRow[] {
    return this.sourceBreakdown(
      this.stats.monthlyRetailCost,
      this.stats.monthlyOrdersCost,
    );
  }

  get profitBreakdown(): SaleStatBreakdownRow[] {
    return this.sourceBreakdown(
      this.stats.monthlyRetailProfit,
      this.stats.monthlyOrdersProfit,
    );
  }

  private sourceBreakdown(
    retail: number,
    orders: number,
  ): SaleStatBreakdownRow[] {
    return [
      { label: 'Ventas', value: retail },
      { label: 'Pedidos', value: orders },
    ];
  }
}
