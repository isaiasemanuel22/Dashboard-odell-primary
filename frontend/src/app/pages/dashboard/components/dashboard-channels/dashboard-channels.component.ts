import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  DashboardProfitabilityChannel,
  SalesChannel,
} from '../../../../core/models';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { salesChannelLabel } from '../../../../shared/utils/v1-labels.util';

const CHANNEL_COLORS: Record<string, string> = {
  [SalesChannel.MAYORISTA]: '#0e7aab',
  [SalesChannel.INSTAGRAM]: '#c13584',
  [SalesChannel.WHATSAPP]: '#15803d',
  [SalesChannel.FERIA]: '#b45309',
  [SalesChannel.TIENDANUBE]: '#6b21a8',
  [SalesChannel.MOSTRADOR]: '#0d7aaa',
  sin_canal: '#64748b',
};

@Component({
  selector: 'app-dashboard-channels',
  standalone: true,
  imports: [CurrencyArsPipe],
  templateUrl: './dashboard-channels.component.html',
  styleUrl: './dashboard-channels.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardChannelsComponent {
  readonly channels = input.required<DashboardProfitabilityChannel[]>();

  protected readonly maxSold = computed(() =>
    Math.max(1, ...this.channels().map((row) => row.sold)),
  );

  protected channelLabel(channel: string): string {
    return salesChannelLabel(channel) || channel;
  }

  protected channelColor(channel: string): string {
    return CHANNEL_COLORS[channel] ?? '#0e7aab';
  }

  protected barWidth(sold: number): number {
    return Math.max(2, (sold / this.maxSold()) * 100);
  }

  protected markupLabel(row: DashboardProfitabilityChannel): string {
    if (row.markupPercent == null) return 'sin margen';
    const pct = Math.round(row.markupPercent);
    if (row.channel === SalesChannel.TIENDANUBE) {
      return `margen ${pct}% (con comisión)`;
    }
    return `margen ${pct}%`;
  }
}
