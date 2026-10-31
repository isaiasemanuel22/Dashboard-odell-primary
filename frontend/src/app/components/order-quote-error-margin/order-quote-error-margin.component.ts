import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { OrderLineDraft, Product } from '../../core/models';
import { CurrencyArsPipe } from '../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-order-quote-error-margin',
  standalone: true,
  imports: [CurrencyArsPipe],
  templateUrl: './order-quote-error-margin.component.html',
  styleUrl: './order-quote-error-margin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQuoteErrorMarginComponent {
  @Input({ required: true }) line!: OrderLineDraft;
  @Input() product: Product | null = null;
  @Input({ required: true }) lineIndex!: number;
  @Input() cost = 0;
  @Input() meta = '';
  @Input() hint = '';
  /** En 3D el bloque se muestra siempre (aunque el costo sea 0). */
  @Input() alwaysShow = false;
  @Output() changed = new EventEmitter<void>();
}
