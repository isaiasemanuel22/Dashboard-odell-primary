import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalesStats } from '../../core/models';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';
import { annualCapPercent, annualCapPercentLabel, uninvoicedDetail } from '../../shared/utils/sales-invoice.util';
import {
  SaleStatBreakdownRow,
  SaleStatCardComponent,
} from '../sale-stat-card/sale-stat-card.component';
import { AreaProfitBalanceComponent } from '../area-profit-balance/area-profit-balance.component';

@Component({
  selector: 'app-sales-stats-grid',
  standalone: true,
  imports: [SaleStatCardComponent, AreaProfitBalanceComponent, CurrencyArsPipe, RouterLink],
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

  get invoicedDetail(): string {
    return uninvoicedDetail(this.stats);
  }

  get capPercent(): number {
    return annualCapPercent(this.stats);
  }

  get capPercentLabel(): string {
    return annualCapPercentLabel(this.stats);
  }

  get netProfitDetail(): string {
    return `Comisiones ${this.formatFees()}`;
  }

  private formatFees(): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(this.stats.monthlyFees ?? 0);
  }

  get ordersDetail(): string {
    const count = this.stats.monthlyOrdersCount;
    return count === 1 ? '1 pedido entregado' : `${count} pedidos entregados`;
  }

  get retailDetail(): string {
    const count = this.stats.monthlyRetailCount;
    return count === 1 ? '1 venta' : `${count} ventas`;
  }

  get profitBreakdown(): SaleStatBreakdownRow[] {
    return this.sourceBreakdown(
      this.stats.monthlyRetailNetProfit ??
        this.stats.monthlyRetailProfit - (this.stats.monthlyRetailFees ?? 0),
      this.stats.monthlyOrdersNetProfit ??
        this.stats.monthlyOrdersProfit - (this.stats.monthlyOrdersFees ?? 0),
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
