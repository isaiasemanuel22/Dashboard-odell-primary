import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyArsPipe } from '../../../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-order-line-pricing',
  standalone: true,
  imports: [FormsModule, CurrencyArsPipe],
  templateUrl: './order-line-pricing.component.html',
  styleUrl: './order-line-pricing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'order-line__pricing order-line__pricing--quote order-line__pricing--panel',
    '[class.order-line__pricing--design]': 'designLayout',
  },
})
export class OrderLinePricingComponent {
  @Input() designLayout = false;
  @Input() quoteVariant = false;
  @Input() quantity: number | string = 1;
  @Input() lineIndex = 0;
  @Input() usePlainCostPrefix = false;
  @Input() unitCostFormatted = '';
  @Input() unitCostHint = '';
  @Input() unitPrice: number | string = 0;
  @Input() unitPriceError = '';
  @Input() priceHint = '';
  @Input() priceHintWarn = false;
  @Input() manualPrice = false;
  @Input() lineTotal = 0;

  @Output() unitPriceChange = new EventEmitter<number | string>();
  @Output() resetPrice = new EventEmitter<void>();
}
