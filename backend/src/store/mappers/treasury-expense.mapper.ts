import {
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from '../../common/enums';
import { TreasuryExpense } from '../../common/interfaces';

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
    occurredAt: new Date(expense.occurredAt),
    createdAt: new Date(expense.createdAt),
  };
}
