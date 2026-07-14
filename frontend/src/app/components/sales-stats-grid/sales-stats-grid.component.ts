import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SalesStats } from '../../core/models';
import { SaleStatCardComponent } from '../sale-stat-card/sale-stat-card.component';

@Component({
  selector: 'app-sales-stats-grid',
  standalone: true,
  imports: [SaleStatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-stats-grid.component.html',
  styleUrl: './sales-stats-grid.component.scss',
})
export class SalesStatsGridComponent {
  @Input({ required: true }) stats!: SalesStats;
}
