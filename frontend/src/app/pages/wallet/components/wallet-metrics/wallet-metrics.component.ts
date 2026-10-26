import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TreasuryOverview } from '../../../../core/models';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-wallet-metrics',
  standalone: true,
  imports: [CurrencyArsPipe],
  templateUrl: './wallet-metrics.component.html',
  styleUrl: './wallet-metrics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletMetricsComponent {
  @Input({ required: true }) overview!: TreasuryOverview;

  get debtorTotal(): number {
    return this.overview.debtors.reduce((sum, debtor) => sum + debtor.amount, 0);
  }
}
