import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import {
  DashboardProfitabilityRankingItem,
  DashboardRankBy,
} from '../../../../core/models';
import { salesChannelLabel } from '../../../../shared/utils/v1-labels.util';
import {
  DB_DATA_TABLE,
  DbPillGroupComponent,
  DbPillOption,
  OdlColumn,
} from '@general-components';

@Component({
  selector: 'app-dashboard-ranking',
  standalone: true,
  imports: [DbPillGroupComponent, ...DB_DATA_TABLE],
  templateUrl: './dashboard-ranking.component.html',
  styleUrl: './dashboard-ranking.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardRankingComponent {
  readonly ranking = input.required<DashboardProfitabilityRankingItem[]>();
  readonly rankBy = input.required<DashboardRankBy>();
  readonly rankByChange = output<DashboardRankBy>();

  protected readonly rankOptions: DbPillOption<DashboardRankBy>[] = [
    { value: 'profit', label: 'Por ganancia total' },
    { value: 'markup', label: 'Por margen %' },
    { value: 'units', label: 'Por unidades' },
  ];

  protected readonly columns: OdlColumn<
    DashboardProfitabilityRankingItem & { rank: number }
  >[] = [
    {
      key: 'rank',
      header: '#',
      type: 'primary',
      value: (row) => String(row.rank),
    },
    {
      key: 'productName',
      header: 'Producto',
      type: 'primary',
      secondary: (row) => this.productNote(row),
    },
    {
      key: 'mainChannel',
      header: 'Canal principal',
      type: 'badge',
      badge: (row) => ({
        label: this.channelLabel(row.mainChannel),
        tone: 'info',
      }),
    },
    {
      key: 'units',
      header: 'Unidades',
      align: 'end',
      value: (row) => String(row.units),
    },
    {
      key: 'profitPerUnit',
      header: 'Ganancia por unidad',
      type: 'money',
      align: 'end',
    },
    {
      key: 'markupPercent',
      header: 'Margen',
      align: 'end',
      value: (row) =>
        row.markupPercent == null ? '—' : `${Math.round(row.markupPercent)}%`,
    },
    {
      key: 'totalProfit',
      header: 'Ganancia total',
      type: 'money',
      align: 'end',
    },
  ];

  protected rankedRows(): (DashboardProfitabilityRankingItem & {
    rank: number;
  })[] {
    return this.ranking().map((row, index) => ({ ...row, rank: index + 1 }));
  }

  protected onRankBy(value: DashboardRankBy): void {
    this.rankByChange.emit(value);
  }

  private channelLabel(channel: string): string {
    return salesChannelLabel(channel) || channel;
  }

  private productNote(row: DashboardProfitabilityRankingItem): string | null {
    if (row.fixedPrice) return 'Precio fijo';
    return null;
  }
}
