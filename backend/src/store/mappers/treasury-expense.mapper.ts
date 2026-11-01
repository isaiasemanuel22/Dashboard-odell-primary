import {
  TreasuryAccount,
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from '../../common/enums';
import { TreasuryExpense } from '../../common/interfaces';

function normalizeAccount(value?: string | null): TreasuryAccount | undefined {
  if (!value) return undefined;
  return Object.values(TreasuryAccount).includes(value as TreasuryAccount)
    ? (value as TreasuryAccount)
    : undefined;
}

export function mapTreasuryExpenseFromDb(row: {
  id: string;
  direction?: string | null;
  category: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  description: string | null;
  referenceId: string | null;
  account?: string | null;
  voidedAt?: Date | null;
  voidReason?: string | null;
  occurredAt: Date;
  createdAt: Date;
}): TreasuryExpense {
  const fallbackName = row.description ?? 'Movimiento';
  return {
    id: row.id,
    direction:
      row.direction === TreasuryMovementDirection.INCOME
        ? TreasuryMovementDirection.INCOME
        : TreasuryMovementDirection.EXPENSE,
    category: row.category as TreasuryExpenseCategory,
    name: row.name.trim() || fallbackName,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    amount: row.amount,
    description: row.description ?? undefined,
    referenceId: row.referenceId ?? undefined,
    account: normalizeAccount(row.account) ?? TreasuryAccount.CAJA,
    voidedAt: row.voidedAt ? row.voidedAt.toISOString() : undefined,
    voidReason: row.voidReason ?? undefined,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapTreasuryExpenseToDb(expense: TreasuryExpense) {
  return {
    id: expense.id,
    direction: expense.direction,
    category: expense.category,
    name: expense.name,
    quantity: expense.quantity,
    unitPrice: expense.unitPrice,
    amount: expense.amount,
    description: expense.description ?? null,
    referenceId: expense.referenceId ?? null,
    account: expense.account ?? TreasuryAccount.CAJA,
    voidedAt: expense.voidedAt ? new Date(expense.voidedAt) : null,
    voidReason: expense.voidReason ?? null,
    occurredAt: new Date(expense.occurredAt),
    createdAt: new Date(expense.createdAt),
  };
}
