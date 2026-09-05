import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AreaProfitBalance } from '../../core/models';
import { SERVICE_TYPE_LABELS } from '../../shared/constants/labels';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-area-profit-balance',
  standalone: true,
  imports: [CurrencyArsPipe],
  templateUrl: './area-profit-balance.component.html',
  styleUrl: './area-profit-balance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AreaProfitBalanceComponent {
  @Input({ required: true }) balances!: AreaProfitBalance[];

  areaLabel(area: AreaProfitBalance['area']): string {
    return SERVICE_TYPE_LABELS[area];
  }
}
