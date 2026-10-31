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
import { Order } from '../../../../core/models';
import { OrdersService } from '../../../../core/services/orders.service';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbInputComponent,
} from '@general-components';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error';
import {
  CurrencyArsPipe,
  DateShortPipe,
} from '../../../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-order-detail-payments',
  standalone: true,
  imports: [
    FormsModule,
    DbInputComponent,
    DbCheckboxComponent,
    DbButtonComponent,
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
  paymentLoading = false;
  paymentError = '';

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

  registerPayment(): void {
    if (this.paymentLoading || !this.paymentAmount) return;
    this.paymentLoading = true;
    this.paymentError = '';
    this.cdr.markForCheck();
    this.ordersService
      .addPayment(this.order.id, {
        amount: Number(this.paymentAmount),
        deposit: this.paymentDeposit,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.paymentAmount = null;
          this.paymentDeposit = false;
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
