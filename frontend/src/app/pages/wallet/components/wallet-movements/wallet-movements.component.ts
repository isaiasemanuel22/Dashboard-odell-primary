import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import {
  TreasuryAccount,
  TreasuryExpense,
  TreasuryExpenseCategory,
  TreasuryMovement,
} from '../../../../core/models';
import {
  DB_DATA_TABLE,
  OdlActionEvent,
  OdlColumn,
  OdlFilter,
  OdlRowAction,
} from '../../../../components/db-data-table';
import { MobileSheetComponent } from '@general-components';
import { CurrencyArsPipe } from '../../../../shared/pipes/labels.pipe';
import { formatCurrencyArs } from '../../../../shared/utils/currency-ars.util';
import {
  paymentMethodLabel,
  treasuryAccountLabel,
  TREASURY_ACCOUNT_LABELS,
} from '../../../../shared/utils/v1-labels.util';
import { formatDateDayMonth } from '../../../../shared/utils/date-format.util';
import { TREASURY_ACCOUNTS_ORDER } from '../../../../shared/utils/treasury-account.util';
import type { WalletAccountFilter } from '../wallet-metrics/wallet-metrics.component';

export type WalletMovementKind = 'income' | 'expense' | 'transfer';

export interface WalletDayGroup {
  key: string;
  label: string;
  movements: TreasuryMovement[];
}

@Component({
  selector: 'app-wallet-movements',
  standalone: true,
  imports: [...DB_DATA_TABLE, CurrencyArsPipe, MobileSheetComponent],
  templateUrl: './wallet-movements.component.html',
  styleUrl: './wallet-movements.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletMovementsComponent implements OnChanges, OnDestroy {
  private static readonly MOBILE_PAGE_SIZE = 20;

  private readonly cdr = inject(ChangeDetectorRef);

  @Input() movements: TreasuryMovement[] = [];
  @Input() expenses: TreasuryExpense[] = [];
  /** Filtro de cuenta del scroll mobile (el desktop usa los filtros de la tabla). */
  @Input() mobileAccountFilter: WalletAccountFilter = 'all';
  /** Texto del buscador mobile (controlado por la barra de la página). */
  @Input() mobileSearch = '';
  @Output() action = new EventEmitter<OdlActionEvent<TreasuryMovement>>();

  sheetMovement: TreasuryMovement | null = null;
  private mobileShown = WalletMovementsComponent.MOBILE_PAGE_SIZE;

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mobileAccountFilter'] || changes['mobileSearch']) {
      this.mobileShown = WalletMovementsComponent.MOBILE_PAGE_SIZE;
    }
  }

  ngOnDestroy(): void {
    this.sheetMovement = null;
  }

  get sortedMovements(): TreasuryMovement[] {
    return [...this.movements].sort((a, b) => {
      const byDate =
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      if (byDate !== 0) return byDate;
      return a.concept.localeCompare(b.concept, 'es');
    });
  }

  get mobileDayGroups(): WalletDayGroup[] {
    const filtered = this.mobileFilteredMovements().slice(0, this.mobileShown);
    const groups = new Map<string, WalletDayGroup>();

    for (const movement of filtered) {
      const key = this.dayKey(movement.occurredAt);
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          label: this.dayLabel(movement.occurredAt),
          movements: [],
        };
        groups.set(key, group);
      }
      group.movements.push(movement);
    }

    return [...groups.values()];
  }

  get mobileRemaining(): number {
    return Math.max(
      0,
      this.mobileFilteredMovements().length - this.mobileShown,
    );
  }

  showMoreMobile(): void {
    this.mobileShown += WalletMovementsComponent.MOBILE_PAGE_SIZE;
    this.cdr.markForCheck();
  }

  conceptSecondary(movement: TreasuryMovement): string | null {
    if (movement.voided) {
      return this.voidMeta(movement);
    }
    return movement.detail?.trim() || null;
  }

  mobileDetail(movement: TreasuryMovement): string {
    const parts = [
      this.accountLabel(movement.account),
      this.methodLabel(movement),
    ];
    const secondary = this.conceptSecondary(movement);
    if (secondary) parts.push(secondary);
    return parts.filter((part) => part && part !== '—').join(' · ');
  }

  sheetDate(movement: TreasuryMovement): string {
    return formatDateDayMonth(movement.occurredAt);
  }

  movementKind(movement: TreasuryMovement): WalletMovementKind {
    if (this.isTransfer(movement)) return 'transfer';
    if (movement.amount < 0) return 'expense';
    return 'income';
  }

  movementIcon(movement: TreasuryMovement): string {
    const kind = this.movementKind(movement);
    if (kind === 'transfer') return '⇄';
    if (kind === 'expense') return '−';
    return '+';
  }

  visibleActions(movement: TreasuryMovement): OdlRowAction<TreasuryMovement>[] {
    return this.actions.filter((action) => !action.hidden?.(movement));
  }

  accountLabel(account: TreasuryAccount | string | null | undefined): string {
    return treasuryAccountLabel(account) || 'Caja efectivo';
  }

  methodLabel(movement: TreasuryMovement): string {
    return paymentMethodLabel(movement.method) || '—';
  }

  openSheet(movement: TreasuryMovement): void {
    if (!this.visibleActions(movement).length) return;
    this.sheetMovement = movement;
    this.cdr.markForCheck();
  }

  closeSheet(): void {
    if (!this.sheetMovement) return;
    this.sheetMovement = null;
    this.cdr.markForCheck();
  }

  sheetSubtitle(movement: TreasuryMovement): string {
    const date = this.sheetDate(movement);
    if (movement.voided) return `Anulado · ${date}`;
    const absolute =
      movement.amount < 0 ? -movement.amount : movement.amount;
    const formatted = formatCurrencyArs(absolute);
    const signed =
      this.movementKind(movement) === 'expense' ? `−${formatted}` : formatted;
    return `${signed} · ${date}`;
  }

  runSheetAction(actionId: string): void {
    const movement = this.sheetMovement;
    if (!movement) return;
    this.closeSheet();
    this.action.emit({ actionId, row: movement });
  }

  private mobileFilteredMovements(): TreasuryMovement[] {
    const query = this.mobileSearch.trim().toLocaleLowerCase('es');
    return this.sortedMovements.filter((movement) => {
      if (this.mobileAccountFilter !== 'all') {
        const account = movement.account ?? TreasuryAccount.CAJA;
        if (account !== this.mobileAccountFilter) return false;
      }
      if (!query) return true;
      return this.searchText(movement).toLocaleLowerCase('es').includes(query);
    });
  }

  private isTransfer(movement: TreasuryMovement): boolean {
    if (movement.concept === 'Transferencia') return true;
    const expense = this.expenseFor(movement);
    return expense?.category === TreasuryExpenseCategory.TRANSFER;
  }

  private canManageRecord(movement: TreasuryMovement): boolean {
    return movement.source === 'record' && !movement.voided;
  }

  private voidMeta(movement: TreasuryMovement): string {
    const expense = this.expenseFor(movement);
    const voidedAt = movement.voidedAt ?? expense?.voidedAt;
    const reason = movement.voidReason ?? expense?.voidReason;
    const datePart = voidedAt
      ? `Anulado el ${formatDateDayMonth(voidedAt)}`
      : 'Anulado';
    if (reason) return `${datePart} · motivo: ${reason}`;
    return datePart;
  }

  private expenseFor(movement: TreasuryMovement): TreasuryExpense | undefined {
    if (!movement.recordId) return undefined;
    return this.expenses.find((expense) => expense.id === movement.recordId);
  }

  private dayKey(iso: string): string {
    const date = new Date(iso);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private dayLabel(iso: string, now: Date = new Date()): string {
    const date = new Date(iso);
    const today = this.dayKey(now.toISOString());
    const key = this.dayKey(iso);
    if (key === today) return 'Hoy';

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (key === this.dayKey(yesterday.toISOString())) return 'Ayer';

    const day = date.getDate();
    const month = date
      .toLocaleDateString('es-AR', { month: 'short' })
      .replace(/\./g, '')
      .trim();
    return `${day} ${month}`;
  }
}
