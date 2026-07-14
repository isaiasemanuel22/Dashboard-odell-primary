import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';

export type SaleStatCardVariant = 'default' | 'accent' | 'warning';

@Component({
  selector: 'app-sale-stat-card',
  standalone: true,
  imports: [CurrencyArsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-stat-card.component.html',
  styleUrl: './sale-stat-card.component.scss',
})
export class SaleStatCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: number;
  @Input() detail = '';
  @Input() variant: SaleStatCardVariant = 'default';
  @Input() currency = true;
}
