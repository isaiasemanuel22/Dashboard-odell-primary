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

interface DebtorActivity {
  headline: string | null;
  detail: string | null;
  overdue: boolean;
}

@Component({
  selector: 'app-wallet-debtors',
  standalone: true,
  imports: [...DB_DATA_TABLE],
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
      key: 'activity',
      header: 'Último movimiento',
      value: (debtor) => this.debtorActivity(debtor).headline,
      secondary: (debtor) => {
        const activity = this.debtorActivity(debtor);
        return activity.overdue ? null : activity.detail;
      },
      note: (debtor) => {
        const activity = this.debtorActivity(debtor);
        return activity.overdue && activity.detail ? { text: activity.detail, tone: 'danger' } : null;
      },
    },
    { key: 'amount', header: 'Monto adeudado', type: 'money' },
    { key: 'repay', header: '', type: 'button', buttonLabel: 'Registrar devolución' },
  ];

  onAction(event: OdlActionEvent<TreasuryDebtorBalance>): void {
    if (event.actionId === 'repay') this.repay.emit(event.row);
  }

  debtorActivity(debtor: TreasuryDebtorBalance): DebtorActivity {
    const key = debtor.name.trim().toLocaleLowerCase('es');
    const records = this.expenses.filter(
      (expense) => expense.name.trim().toLocaleLowerCase('es') === key,
    );
    const latestLoan = this.latestByDate(
      records.filter((expense) => expense.category === TreasuryExpenseCategory.LOAN),
    );
    const latestFollowUp = this.latestByDate(
      records.filter(
        (expense) =>
          expense.category === TreasuryExpenseCategory.LOAN_REPAYMENT ||
          expense.category === TreasuryExpenseCategory.PAYMENT,
      ),
    );
    const followUpApplies =
      latestFollowUp != null &&
      (latestLoan == null ||
        new Date(latestFollowUp.occurredAt).getTime() >=
          new Date(latestLoan.occurredAt).getTime());

    let detail: string | null = null;
    let overdue = false;
    if (followUpApplies && latestFollowUp) {
      const verb =
        latestFollowUp.category === TreasuryExpenseCategory.LOAN_REPAYMENT
          ? 'Devolvió'
          : 'Pagó';
      detail = `${verb} ${this.formatMoney(latestFollowUp.amount)}`;
    } else if (latestLoan && this.isOlderThanDays(latestLoan.occurredAt, 90)) {
      detail = 'Más de 90 días';
      overdue = true;
    }

    return {
      headline: latestLoan
        ? `Préstamo · ${this.expenseDateLabel(latestLoan)}`
        : null,
      detail,
      overdue,
    };
  }

  private expenseDateLabel(expense: TreasuryExpense): string {
    return new Date(expense.occurredAt).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private latestByDate(records: TreasuryExpense[]): TreasuryExpense | null {
    return records.reduce<TreasuryExpense | null>((latest, record) => {
      if (!latest) return record;
      return new Date(record.occurredAt).getTime() >
        new Date(latest.occurredAt).getTime()
        ? record
        : latest;
    }, null);
  }

  private isOlderThanDays(iso: string, days: number): boolean {
    const date = new Date(iso);
    const today = new Date();
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return today.getTime() - date.getTime() > days * 24 * 60 * 60 * 1000;
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
