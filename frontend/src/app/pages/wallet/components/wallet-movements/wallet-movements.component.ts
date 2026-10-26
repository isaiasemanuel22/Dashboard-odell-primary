import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  Supply,
  TreasuryExpense,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from '../../../../core/models';
import { FILAMENT_TYPE_LABELS, RESIN_TYPE_LABELS } from '../../../../shared/constants/labels';
import { computeSupplyPurchaseDelta } from '../../../../shared/utils/supply-unit.util';
import {
  DB_DATA_TABLE,
  OdlBadge,
  OdlColumn,
  OdlFilter,
} from '../../../../components/db-data-table';

@Component({
  selector: 'app-wallet-movements',
  standalone: true,
  imports: [...DB_DATA_TABLE],
  templateUrl: './wallet-movements.component.html',
  styleUrl: './wallet-movements.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletMovementsComponent {
  @Input() expenses: TreasuryExpense[] = [];
  @Input() supplies: Supply[] = [];

  readonly searchText = (expense: TreasuryExpense) =>
    [expense.name, this.recordTypeLabel(expense), this.conceptMeta(expense) ?? ''].join(' ');

  readonly movementFilters: OdlFilter<TreasuryExpense>[] = [
    { id: 'all', label: 'Todos' },
    { id: 'income', label: 'Ingresos', predicate: (expense) => expense.direction === TreasuryMovementDirection.INCOME },
    { id: 'expense', label: 'Egresos', predicate: (expense) => expense.direction === TreasuryMovementDirection.EXPENSE },
    { id: 'supply', label: 'Compra de insumos', predicate: (expense) => expense.category === TreasuryExpenseCategory.SUPPLY_PURCHASE },
    { id: 'loan', label: 'Préstamos', predicate: (expense) => expense.category === TreasuryExpenseCategory.LOAN },
    { id: 'repayment', label: 'Devoluciones', predicate: (expense) => expense.category === TreasuryExpenseCategory.LOAN_REPAYMENT },
  ];

  readonly columns: OdlColumn<TreasuryExpense>[] = [
    { key: 'occurredAt', header: 'Fecha', type: 'date', sortable: true },
    { key: 'name', header: 'Concepto', type: 'primary', secondary: (expense) => this.conceptMeta(expense) },
    { key: 'tipo', header: 'Movimiento', type: 'badge', badge: (expense) => this.movementBadge(expense) },
    { key: 'quantity', header: 'Cantidad', type: 'number' },
    { key: 'unitPrice', header: 'Valor unit.', type: 'money' },
    {
      key: 'amount',
      header: 'Monto',
      type: 'signedMoney',
      value: (expense) => this.recordDisplayAmount(expense),
      note: (expense) => {
        const savings = this.supplyPurchaseSavings(expense);
        return savings ? { text: `Ahorro $ ${savings.toLocaleString('es-AR')}`, tone: 'success' } : null;
      },
    },
  ];

  get sortedExpenses(): TreasuryExpense[] {
    return [...this.expenses].sort((a, b) => {
      const byDate = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      if (byDate !== 0) return byDate;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  expenseDateLabel(expense: TreasuryExpense): string {
    return new Date(expense.occurredAt).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  recordTypeLabel(expense: TreasuryExpense): string {
    if (expense.category === TreasuryExpenseCategory.SUPPLY_PURCHASE) {
      return 'Compra de insumos';
    }
    if (expense.category === TreasuryExpenseCategory.PAYMENT) {
      return 'Pago';
    }
    if (expense.category === TreasuryExpenseCategory.LOAN) {
      return 'Préstamo';
    }
    if (expense.category === TreasuryExpenseCategory.LOAN_REPAYMENT) {
      return 'Devolución';
    }
    return expense.direction === TreasuryMovementDirection.INCOME
      ? 'Ingreso'
      : 'Egreso';
  }

  isIncomeRecord(expense: TreasuryExpense): boolean {
    return expense.direction === TreasuryMovementDirection.INCOME;
  }

  isExpenseRecord(expense: TreasuryExpense): boolean {
    return expense.direction === TreasuryMovementDirection.EXPENSE;
  }

  recordDisplayAmount(expense: TreasuryExpense): number {
    return this.isExpenseRecord(expense) ? -expense.amount : expense.amount;
  }

  movementChipClass(expense: TreasuryExpense): string {
    if (expense.category === TreasuryExpenseCategory.SUPPLY_PURCHASE) {
      return 'movement-chip movement-chip--compra';
    }
    if (expense.category === TreasuryExpenseCategory.PAYMENT) {
      return 'movement-chip movement-chip--pago';
    }
    if (expense.category === TreasuryExpenseCategory.LOAN) {
      return 'movement-chip movement-chip--prestamo';
    }
    if (expense.category === TreasuryExpenseCategory.LOAN_REPAYMENT) {
      return 'movement-chip movement-chip--devolucion';
    }
    return this.isIncomeRecord(expense)
      ? 'movement-chip movement-chip--ingreso'
      : 'movement-chip movement-chip--egreso';
  }

  conceptMeta(expense: TreasuryExpense): string | null {
    if (expense.category !== TreasuryExpenseCategory.SUPPLY_PURCHASE) {
      return null;
    }
    const supply = this.supplies.find((item) => item.name === expense.name);
    if (!supply) return null;
    const material = supply.filamentType
      ? FILAMENT_TYPE_LABELS[supply.filamentType] ?? supply.filamentType.toUpperCase()
      : supply.resinType
        ? RESIN_TYPE_LABELS[supply.resinType] ?? supply.resinType
        : '';
    const line = [supply.brand, material].filter(Boolean).join(' · ');
    return line || null;
  }

  supplyPurchaseSavings(expense: TreasuryExpense): number | null {
    if (expense.category !== TreasuryExpenseCategory.SUPPLY_PURCHASE) {
      return null;
    }

    const savings = -computeSupplyPurchaseDelta(
      expense.amount,
      expense.quantity,
      expense.unitPrice,
    );
    return savings > 0 ? savings : null;
  }

  private movementBadge(expense: TreasuryExpense): OdlBadge {
    const label = this.recordTypeLabel(expense);
    if (expense.category === TreasuryExpenseCategory.SUPPLY_PURCHASE) return { label, tone: 'pending' };
    if (expense.category === TreasuryExpenseCategory.PAYMENT) return { label, tone: 'neutral' };
    if (expense.category === TreasuryExpenseCategory.LOAN) return { label, tone: 'info' };
    if (expense.category === TreasuryExpenseCategory.LOAN_REPAYMENT) return { label, tone: 'ok' };
    return { label, tone: this.isIncomeRecord(expense) ? 'ok' : 'danger' };
  }
}
