import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DbInputComponent } from '@general-components';
import { DiscountMode } from '../../../../shared/utils/discount.util';

@Component({
  selector: 'app-order-form-discount',
  standalone: true,
  imports: [FormsModule, DbInputComponent],
  templateUrl: './order-form-discount.component.html',
  styleUrl: './order-form-discount.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'quote-discount',
    '[class.quote-discount--resumen]': 'variant === "resumen"',
  },
})
export class OrderFormDiscountComponent {
  @Input({ required: true }) mode!: DiscountMode;
  @Input() percent = 0;
  @Input() amount = 0;
  @Input() percentMax = 100;
  @Input() amountMax = 0;
  @Input() hint = '';
  @Input() noneLabel = 'Sin';
  @Input() variant: 'inline' | 'resumen' = 'inline';

  @Output() modeChange = new EventEmitter<DiscountMode>();
  @Output() percentChange = new EventEmitter<number | string>();
  @Output() amountChange = new EventEmitter<number | string>();
}
