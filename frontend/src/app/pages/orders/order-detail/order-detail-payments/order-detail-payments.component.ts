import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
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
  MobileAmountInputComponent,
  MobileChipGroupComponent,
  MobileToggleRowComponent,
  type DbSegmentOption,
  type DbSelectOption,
  type MobileChipOption,
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
import { orderBalanceAmount, orderPaidAmount } from '../../../../shared/utils/order.helpers';
import { formatCurrencyArs } from '../../../../shared/utils/currency-ars.util';

type AmountShortcut = 'full' | 'half' | 'other';

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
    MobileAmountInputComponent,
    MobileChipGroupComponent,
    MobileToggleRowComponent,
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

  @ViewChild(MobileAmountInputComponent)
  private readonly amountInput?: MobileAmountInputComponent;

  /** full = panel desktop; summary = historial mobile; sheet = hoja inferior. */
  @Input() presentation: 'full' | 'summary' | 'sheet' = 'full';
  @Input({ required: true }) order!: Order;
  @Output() orderChange = new EventEmitter<Order>();

  paymentAmount: number | null = null;
  paymentDeposit = false;
  paymentMethod: PaymentMethod = PaymentMethod.EFECTIVO;
  paymentAccount: TreasuryAccount = TreasuryAccount.CAJA;
  paymentFee: number | null = null;
  paymentLoading = false;
  paymentError = '';
  amountShortcut: AmountShortcut | null = 'full';
  voidingPaymentId: string | null = null;
  voidReason = '';
  voidLoading = false;
  voidError = '';

  readonly amountChipOptions: MobileChipOption<AmountShortcut>[] = [
    { value: 'full', label: 'Todo el saldo' },
    { value: 'half', label: '50 %' },
    { value: 'other', label: 'Otro monto' },
  ];

  readonly methodOptions: DbSegmentOption<PaymentMethod>[] =
    labelsToSelectOptions(PAYMENT_METHOD_LABELS);
  readonly methodChipOptions: MobileChipOption<PaymentMethod>[] =
    this.methodOptions.map((opt) => ({
      value: opt.value,
      label: opt.label,
    }));
  readonly accountOptions: DbSelectOption[] =
    labelsToSelectOptions(TREASURY_ACCOUNT_LABELS);

  readonly paymentMethodLabel = paymentMethodLabel;
  readonly treasuryAccountLabel = treasuryAccountLabel;

  get paidAmount(): number {
    return orderPaidAmount(this.order);
  }

  get balanceAmount(): number {
    return orderBalanceAmount(this.order);
  }

  get hasValidAmount(): boolean {
    const amount = Number(this.paymentAmount);
    return Number.isFinite(amount) && amount > 0;
  }

  /** Hay un monto escrito pero es cero o negativo. */
  get showAmountError(): boolean {
    return (
      this.paymentAmount !== null &&
      this.paymentAmount !== undefined &&
      String(this.paymentAmount) !== '' &&
      !this.hasValidAmount
    );
  }

  get paymentStatusLabel(): string {
    if (this.paidAmount <= 0) return 'No pagado';
    if (this.balanceAmount <= 0) return 'Pagado';
    return 'Parcialmente pagado';
  }

  /** Neto = monto − comisión (solo si hay monto válido). */
  get netAmount(): number | null {
    const amount = Number(this.paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const fee = Number(this.paymentFee);
    const safeFee = Number.isFinite(fee) && fee > 0 ? fee : 0;
    return Math.round((amount - safeFee) * 100) / 100;
  }

  get sheetSubmitLabel(): string {
    if (this.paymentLoading) return 'Registrando...';
    const amount = Number(this.paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return 'Registrar pago';
    return `Registrar ${formatCurrencyArs(amount)}`;
  }

  preparePayment(amount: number, options?: { scroll?: boolean }): void {
    this.paymentAmount = amount;
    this.syncShortcutFromAmount();
    this.paymentError = '';
    this.cdr.markForCheck();
    if (options?.scroll === false) return;
    document.getElementById('order-payments')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  onMethodChange(method: PaymentMethod): void {
    this.paymentMethod = method;
    this.paymentAccount = defaultAccountForMethod(method);
  }

  onMethodChipChange(method: PaymentMethod | null): void {
    if (method == null) return;
    this.onMethodChange(method);
    this.cdr.markForCheck();
  }

  onAmountShortcutChange(shortcut: AmountShortcut | null): void {
    if (shortcut == null) return;
    this.amountShortcut = shortcut;
    if (shortcut === 'full') {
      this.paymentAmount = Math.round(this.balanceAmount);
    } else if (shortcut === 'half') {
      this.paymentAmount = Math.round(this.balanceAmount / 2);
    } else if (shortcut === 'other') {
      this.paymentAmount = null;
      this.cdr.markForCheck();
      queueMicrotask(() => this.amountInput?.focus());
      return;
    }
    this.cdr.markForCheck();
  }

  onAmountShortcutSynced(): void {
    this.syncShortcutFromAmount();
    this.cdr.markForCheck();
  }

  onDepositToggle(checked: boolean): void {
    this.paymentDeposit = checked;
    this.cdr.markForCheck();
  }

  private syncShortcutFromAmount(): void {
    const amount = Number(this.paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.amountShortcut = 'other';
      return;
    }
    const balance = Math.round(this.balanceAmount);
    const half = Math.round(this.balanceAmount / 2);
    if (Math.round(amount) === balance) {
      this.amountShortcut = 'full';
      return;
    }
    if (Math.round(amount) === half) {
      this.amountShortcut = 'half';
      return;
    }
    this.amountShortcut = 'other';
  }

  startVoid(paymentId: string): void {
    this.voidingPaymentId = paymentId;
    this.voidReason = '';
    this.voidError = '';
    this.cdr.markForCheck();
  }

  cancelVoid(): void {
    this.voidingPaymentId = null;
    this.voidReason = '';
    this.voidError = '';
    this.cdr.markForCheck();
  }

  confirmVoid(): void {
    const reason = this.voidReason.trim();
    if (!this.voidingPaymentId || this.voidLoading) return;
    if (!reason) {
      this.voidError = 'El motivo es obligatorio';
      this.cdr.markForCheck();
      return;
    }
    this.voidLoading = true;
    this.voidError = '';
    this.cdr.markForCheck();
    this.ordersService
      .voidPayment(this.order.id, this.voidingPaymentId, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.voidLoading = false;
          this.voidingPaymentId = null;
          this.voidReason = '';
          this.orderChange.emit(order);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.voidLoading = false;
          this.voidError = extractApiErrorMessage(
            err,
            'No se pudo anular el pago',
          );
          this.cdr.markForCheck();
        },
      });
  }

  registerPayment(): void {
    if (this.paymentLoading || !this.hasValidAmount) return;
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
