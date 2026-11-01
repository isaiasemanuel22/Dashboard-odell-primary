import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DbInputComponent,
  DbSegmentedControlComponent,
  DbSelectComponent,
  DbSegmentOption,
  DbSelectOption,
} from '@general-components';
import { PaymentMethod } from '../../../../core/models';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { DiscountMode } from '../../../../shared/utils/discount.util';
import { OrderFormDiscountComponent } from '../order-form-discount/order-form-discount.component';

@Component({
  selector: 'app-order-form-order-summary',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    DbInputComponent,
    DbSelectComponent,
    DbSegmentedControlComponent,
    OrderFormDiscountComponent,
  ],
  templateUrl: './order-form-order-summary.component.html',
  styleUrl: './order-form-order-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class OrderFormOrderSummaryComponent {
  @Input() listSubtotal = 0;
  @Input() wholesalePercent = 0;
  @Input() wholesaleDiscountAmount = 0;
  @Input() wholesaleProductsBase = 0;
  @Input() wholesaleApplied = false;
  @Input() resellerSavings = 0;

  @Input() discountMode: DiscountMode = 'none';
  @Input() discountPercent = 0;
  @Input() discountAmount = 0;
  @Input() discountPercentMax = 99;
  @Input() discountAmountMax = 0;
  @Input() discountHint = '';
  @Input() discountApplied = 0;

  @Input() total = 0;
  @Input() totalCost = 0;
  @Input() paymentFee = 0;
  @Input() profit = 0;
  @Input() profitPercentOnCost = 0;
  @Input() listProfit = 0;

  @Input() showDeposit = false;
  @Input() depositAmount: number | null = null;
  @Input() depositSuggested = 0;
  @Input() depositPercent = 50;
  @Input() depositMethod: PaymentMethod = PaymentMethod.TRANSFERENCIA;
  @Input() depositMethodOptions: DbSegmentOption<PaymentMethod>[] = [];
  @Input() depositAccount = '';
  @Input() depositAccountOptions: DbSelectOption[] = [];
  @Input() depositFee: number | null = null;
  @Input() balanceAfterDeposit = 0;

  @Output() modeChange = new EventEmitter<DiscountMode>();
  @Output() percentChange = new EventEmitter<number | string>();
  @Output() amountChange = new EventEmitter<number | string>();

  @Output() depositAmountChange = new EventEmitter<number | null>();
  @Output() depositMethodChange = new EventEmitter<PaymentMethod>();
  @Output() depositAccountChange = new EventEmitter<string>();
  @Output() depositFeeChange = new EventEmitter<number | null>();
}
