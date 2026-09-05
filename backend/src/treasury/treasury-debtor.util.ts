import { TreasuryExpenseCategory } from '../common/enums';
import { TreasuryExpense } from '../common/interfaces';

export interface TreasuryDebtorBalance {
  name: string;
  amount: number;
}

export function computeDebtorBalances(
  records: TreasuryExpense[],
): TreasuryDebtorBalance[] {
  const balances = new Map<string, { displayName: string; amount: number }>();

  for (const record of records) {
    const name = record.name.trim();
    if (!name) continue;

    const delta =
      record.category === TreasuryExpenseCategory.LOAN
        ? record.amount
        : record.category === TreasuryExpenseCategory.LOAN_REPAYMENT
          ? -record.amount
          : 0;

    if (delta === 0) continue;

    const key = name.toLocaleLowerCase('es');
    const entry = balances.get(key) ?? { displayName: name, amount: 0 };
    entry.amount += delta;
    entry.displayName = name;
    balances.set(key, entry);
  }

  return [...balances.values()]
    .filter((entry) => entry.amount > 0)
    .map((entry) => ({
      name: entry.displayName,
      amount: Math.round(entry.amount),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function getDebtorOutstanding(
  records: TreasuryExpense[],
  name: string,
): number {
  const key = name.trim().toLocaleLowerCase('es');
  if (!key) return 0;

  return (
    computeDebtorBalances(records).find(
      (debtor) => debtor.name.toLocaleLowerCase('es') === key,
    )?.amount ?? 0
  );
}
