import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { DiscountMode } from '../../../../shared/utils/discount.util';
import { OrderFormDiscountComponent } from '../order-form-discount/order-form-discount.component';
import {
  QuoteAreaShare,
  QuoteResumenItem,
} from './order-form-quote-summary.util';

export type { QuoteAreaShare, QuoteResumenItem };

@Component({
  selector: 'app-order-form-quote-summary',
  standalone: true,
  imports: [NgClass, CurrencyArsPipe, OrderFormDiscountComponent],
  templateUrl: './order-form-quote-summary.component.html',
  styleUrl: './order-form-quote-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class OrderFormQuoteSummaryComponent {
  @Input() items: QuoteResumenItem[] = [];
  @Input() subtotalLabel = '';
  @Input() subtotal = 0;
  @Input({ required: true }) discountMode!: DiscountMode;
  @Input() discountPercent = 0;
  @Input() discountAmount = 0;
  @Input() discountPercentMax = 100;
  @Input() discountAmountMax = 0;
  @Input() discountHint = '';
  @Input() discountApplied = 0;
  @Input() total = 0;
  @Input() totalCost = 0;
  @Input() profit = 0;
  @Input() depositPercent = 0;
  @Input() depositAmount = 0;
  @Input() areaShares: QuoteAreaShare[] = [];
  @Input() warnings: string[] = [];

  @Output() modeChange = new EventEmitter<DiscountMode>();
  @Output() percentChange = new EventEmitter<number | string>();
  @Output() amountChange = new EventEmitter<number | string>();
}
