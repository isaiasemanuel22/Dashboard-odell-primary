import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import {
  TreasuryAccount,
  TreasuryExpense,
  TreasuryMovement,
} from '../../../../core/models';
import {
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlFilter,
  OdlRowAction,
} from '../../../../components/db-data-table';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import {
  paymentMethodLabel,
  treasuryAccountLabel,
  TREASURY_ACCOUNT_LABELS,
} from '../../../../shared/utils/v1-labels.util';
import { formatDateDayMonth } from '../../../../shared/utils/date-format.util';
import { TREASURY_ACCOUNTS_ORDER } from '../../../../shared/utils/treasury-account.util';

@Component({
  selector: 'app-wallet-movements',
  standalone: true,
  imports: [...DB_DATA_TABLE, CurrencyArsPipe],
  templateUrl: './wallet-movements.component.html',
  styleUrl: './wallet-movements.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletMovementsComponent {
  @Input() movements: TreasuryMovement[] = [];
  @Input() expenses: TreasuryExpense[] = [];
  @Output() action = new EventEmitter<OdlActionEvent<TreasuryMovement>>();

  readonly actions: OdlRowAction<TreasuryMovement>[] = [
    {
      id: 'editar',
      label: 'Editar',
      hidden: (row) => !this.canManageRecord(row),
    },
    {
      id: 'anular',
      label: 'Anular',
      danger: true,
      hidden: (row) => !this.canManageRecord(row),
    },
    {
      id: 'ver-pedido',
      label: 'Ver pedido',
      hidden: (row) => row.source !== 'order_payment' || !row.orderId,
    },
    {
      id: 'ver-venta',
      label: 'Ver venta',
      hidden: (row) => row.source !== 'retail_sale',
    },
  ];

  readonly searchText = (movement: TreasuryMovement) =>
    [
      movement.concept,
      movement.detail ?? '',
      this.accountLabel(movement.account),
      this.methodLabel(movement),
      movement.voidReason ?? '',
    ].join(' ');

  readonly accountFilters: OdlFilter<TreasuryMovement>[] = [
    { id: 'all', label: 'Todas las cuentas' },
    ...TREASURY_ACCOUNTS_ORDER.map((account) => ({
      id: account,
      label: TREASURY_ACCOUNT_LABELS[account],
      predicate: (movement: TreasuryMovement) =>
        (movement.account ?? TreasuryAccount.CAJA) === account,
    })),
  ];

  readonly columns: OdlColumn<TreasuryMovement>[] = [
    { key: 'occurredAt', header: 'Fecha', type: 'date', sortable: true },
    {
      key: 'concept',
      header: 'Concepto',
      type: 'custom',
      value: (movement) => movement.concept,
      sortable: true,
    },
    {
      key: 'account',
      header: 'Cuenta',
      value: (movement) => this.accountLabel(movement.account),
    },
    {
      key: 'method',
      header: 'Medio',
      value: (movement) => this.methodLabel(movement),
    },
    {
      key: 'amount',
      header: 'Monto',
      type: 'custom',
      value: (movement) => movement.amount,
      align: 'end',
      sortable: true,
    },
    {
      key: 'fee',
      header: 'Comisión',
      type: 'custom',
      value: (movement) => movement.fee,
      align: 'end',
    },
    {
      key: 'net',
      header: 'Neto',
      type: 'custom',
      value: (movement) => movement.net,
      align: 'end',
      sortable: true,
    },
  ];

  get sortedMovements(): TreasuryMovement[] {
    return [...this.movements].sort((a, b) => {
      const byDate =
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      if (byDate !== 0) return byDate;
      return a.concept.localeCompare(b.concept, 'es');
    });
  }

  conceptSecondary(movement: TreasuryMovement): string | null {
    if (movement.voided) {
      return this.voidMeta(movement);
    }
    return movement.detail?.trim() || null;
  }

  accountLabel(account: TreasuryAccount | string | null | undefined): string {
    return treasuryAccountLabel(account) || 'Caja efectivo';
  }

  methodLabel(movement: TreasuryMovement): string {
    return paymentMethodLabel(movement.method) || '—';
  }

  private canManageRecord(movement: TreasuryMovement): boolean {
    return movement.source === 'record' && !movement.voided;
  }

  private voidMeta(movement: TreasuryMovement): string {
    const expense = this.expenseFor(movement);
    const voidedAt = movement.voidedAt ?? expense?.voidedAt;
    const reason = movement.voidReason ?? expense?.voidReason;
    const datePart = voidedAt
      ? `Anulado el ${this.formatDayMonth(voidedAt)}`
      : 'Anulado';
    if (reason) return `${datePart} · motivo: ${reason}`;
    return datePart;
  }

  private expenseFor(movement: TreasuryMovement): TreasuryExpense | undefined {
    if (!movement.recordId) return undefined;
    return this.expenses.find((expense) => expense.id === movement.recordId);
  }

  private formatDayMonth(iso: string): string {
    return formatDateDayMonth(iso);
  }
}
