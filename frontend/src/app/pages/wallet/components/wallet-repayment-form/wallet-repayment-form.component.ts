import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { TreasuryDebtorBalance, TreasuryExpenseCategory } from '../../../../core/models';
import { TreasuryService } from '../../../../core/services/treasury.service';
import {
  DbButtonComponent,
  DbFormGridComponent,
  DbInputComponent,
  FormModalComponent,
} from '@general-components';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error';

@Component({
  selector: 'app-wallet-repayment-form',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    DbButtonComponent,
    DbInputComponent,
    DbFormGridComponent,
    FormModalComponent,
  ],
  templateUrl: './wallet-repayment-form.component.html',
  styleUrl: '../wallet-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletRepaymentFormComponent implements OnInit {
  private readonly treasuryService = inject(TreasuryService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) debtor!: TreasuryDebtorBalance;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly maxExpenseDate = WalletRepaymentFormComponent.todayInputValue();
  repaymentSaving = false;
  repaymentError = '';
  repaymentAmount = 0;
  repaymentDate = WalletRepaymentFormComponent.todayInputValue();

  ngOnInit(): void {
    this.repaymentAmount = this.debtor.amount;
  }

  onRepaymentAmountChange(): void {
    this.repaymentAmount = Math.max(0, Math.round(Number(this.repaymentAmount) || 0));
    this.cdr.markForCheck();
  }

  submitRepayment(): void {
    const occurredAt = this.repaymentDate;
    const amount = Math.round(Number(this.repaymentAmount) || 0);

    if (!occurredAt) {
      this.repaymentError = 'Seleccioná una fecha.';
      this.cdr.markForCheck();
      return;
    }

    if (amount <= 0) {
      this.repaymentError = 'El monto debe ser mayor a cero.';
      this.cdr.markForCheck();
      return;
    }

    if (amount > this.debtor.amount) {
      this.repaymentError = `El monto supera la deuda pendiente (${this.debtor.amount}).`;
      this.cdr.markForCheck();
      return;
    }

    this.repaymentSaving = true;
    this.repaymentError = '';
    this.cdr.markForCheck();

    this.treasuryService
      .createExpense({
        isSupplyPurchase: false,
        category: TreasuryExpenseCategory.LOAN_REPAYMENT,
        name: this.debtor.name,
        amount,
        occurredAt,
      })
      .pipe(
        finalize(() => {
          this.repaymentSaving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => this.saved.emit(),
        error: (err) => {
          this.repaymentError = extractApiErrorMessage(
            err,
            'No se pudo registrar la devolución',
          );
          this.cdr.markForCheck();
        },
      });
  }

  private static todayInputValue(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
