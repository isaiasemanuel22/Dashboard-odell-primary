import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  Order,
  PaymentMethod,
  TreasuryAccount,
} from '../../../../core/models';
import { OrdersService } from '../../../../core/services/orders.service';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbInputComponent,
  DbSegmentedControlComponent,
  DbSelectComponent,
  DbSegmentOption,
  DbSelectOption,
} from '@general-components';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error';
import {
  CurrencyArsPipe,
  DateShortPipe,
} from '../../../../shared/pipes/labels.pipe';
import {
  PAYMENT_METHOD_LABELS,
  TREASURY_ACCOUNT_LABELS,
  paymentMethodLabel,
  treasuryAccountLabel,
} from '../../../../shared/utils/v1-labels.util';
import { labelsToSelectOptions } from '../../../../shared/utils/select-options';
import { defaultAccountForMethod } from '../../../../shared/utils/treasury-account.util';

@Component({
  selector: 'app-order-detail-payments',
  standalone: true,
  imports: [
    FormsModule,
    DbInputComponent,
    DbCheckboxComponent,
    DbButtonComponent,
    DbSelectComponent,
    DbSegmentedControlComponent,
    CurrencyArsPipe,
    DateShortPipe,
  ],
  templateUrl: './order-detail-payments.component.html',
  styleUrl: './order-detail-payments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class OrderDetailPaymentsComponent {
  private readonly ordersService = inject(OrdersService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) order!: Order;
  @Output() orderChange = new EventEmitter<Order>();

  paymentAmount: number | null = null;
  paymentDeposit = false;
  paymentMethod: PaymentMethod = PaymentMethod.EFECTIVO;
  paymentAccount: TreasuryAccount = TreasuryAccount.CAJA;
  paymentFee: number | null = null;
  paymentLoading = false;
  paymentError = '';

  readonly methodOptions: DbSegmentOption<PaymentMethod>[] =
    labelsToSelectOptions(PAYMENT_METHOD_LABELS);
  readonly accountOptions: DbSelectOption[] =
    labelsToSelectOptions(TREASURY_ACCOUNT_LABELS);

  readonly paymentMethodLabel = paymentMethodLabel;
  readonly treasuryAccountLabel = treasuryAccountLabel;

  get paidAmount(): number {
    return (this.order.payments ?? []).reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0,
    );
  }

  get balanceAmount(): number {
    return Math.max(0, Math.round((this.order.total - this.paidAmount) * 100) / 100);
  }

  get paymentStatusLabel(): string {
    if (this.paidAmount <= 0) return 'No pagado';
    if (this.balanceAmount <= 0) return 'Pagado';
    return 'Parcialmente pagado';
  }

  preparePayment(amount: number): void {
    this.paymentAmount = amount;
    this.paymentError = '';
    this.cdr.markForCheck();
    document.getElementById('order-payments')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  onMethodChange(method: PaymentMethod): void {
    this.paymentMethod = method;
    this.paymentAccount = defaultAccountForMethod(method);
  }

  registerPayment(): void {
    if (this.paymentLoading || !this.paymentAmount) return;
    this.paymentLoading = true;
    this.paymentError = '';
    this.cdr.markForCheck();
    const fee = Number(this.paymentFee);
    this.ordersService
      .addPayment(this.order.id, {
        amount: Number(this.paymentAmount),
        deposit: this.paymentDeposit,
        method: this.paymentMethod,
        account: this.paymentAccount,
        ...(Number.isFinite(fee) && fee > 0 ? { fee: Math.round(fee) } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.paymentAmount = null;
          this.paymentDeposit = false;
          this.paymentFee = null;
          this.paymentMethod = PaymentMethod.EFECTIVO;
          this.paymentAccount = defaultAccountForMethod(this.paymentMethod);
          this.paymentLoading = false;
          this.orderChange.emit(order);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.paymentLoading = false;
          this.paymentError = extractApiErrorMessage(
            err,
            'No se pudo registrar el pago',
          );
          this.cdr.markForCheck();
        },
      });
  }
}
