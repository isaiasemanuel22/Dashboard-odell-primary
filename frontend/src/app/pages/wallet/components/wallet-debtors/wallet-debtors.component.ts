import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  TreasuryDebtorBalance,
  TreasuryExpense,
  TreasuryExpenseCategory,
} from '../../../../core/models';
import {
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
} from '../../../../components/db-data-table';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';

/** Misma normalización que el backend (`loanPersonName`). */
function loanPersonKey(name: string): string {
  return name
    .trim()
    .replace(/^préstamo a\s+/i, '')
    .trim()
    .toLocaleLowerCase('es');
}

@Component({
  selector: 'app-wallet-debtors',
  standalone: true,
  imports: [...DB_DATA_TABLE, CurrencyArsPipe],
  templateUrl: './wallet-debtors.component.html',
  styleUrl: './wallet-debtors.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletDebtorsComponent {
  @Input() debtors: TreasuryDebtorBalance[] = [];
  @Input() expenses: TreasuryExpense[] = [];
  @Output() repay = new EventEmitter<TreasuryDebtorBalance>();

  readonly columns: OdlColumn<TreasuryDebtorBalance>[] = [
    { key: 'name', header: 'Persona', type: 'primary' },
    {
      key: 'lent',
      header: 'Le prestaste',
      type: 'custom',
      align: 'end',
      value: (debtor) => this.lentTotal(debtor),
    },
    {
      key: 'repaid',
      header: 'Te devolvió',
      type: 'custom',
      align: 'end',
      value: (debtor) => this.repaidTotal(debtor),
    },
    { key: 'amount', header: 'Debe', type: 'money', align: 'end' },
    {
      key: 'repay',
      header: '',
      type: 'button',
      buttonLabel: 'Registrar devolución',
    },
  ];

  onAction(event: OdlActionEvent<TreasuryDebtorBalance>): void {
    if (event.actionId === 'repay') this.repay.emit(event.row);
  }

  /** Totales de presentación desde expenses (solo loan / loan_repayment). */
  lentTotal(debtor: TreasuryDebtorBalance): number {
    return this.sumFor(debtor, TreasuryExpenseCategory.LOAN);
  }

  repaidTotal(debtor: TreasuryDebtorBalance): number {
    return this.sumFor(debtor, TreasuryExpenseCategory.LOAN_REPAYMENT);
  }

  hasLoanHistory(debtor: TreasuryDebtorBalance): boolean {
    return this.recordsFor(debtor).length > 0;
  }

  private sumFor(
    debtor: TreasuryDebtorBalance,
    category: TreasuryExpenseCategory,
  ): number {
    return this.recordsFor(debtor)
      .filter((expense) => expense.category === category)
      .reduce((sum, expense) => sum + expense.amount, 0);
  }

  private recordsFor(debtor: TreasuryDebtorBalance): TreasuryExpense[] {
    const key = loanPersonKey(debtor.name);
    return this.expenses.filter(
      (expense) =>
        !expense.voidedAt &&
        (expense.category === TreasuryExpenseCategory.LOAN ||
          expense.category === TreasuryExpenseCategory.LOAN_REPAYMENT) &&
        loanPersonKey(expense.name) === key,
    );
  }
}
