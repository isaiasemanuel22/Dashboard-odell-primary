import {
  TreasuryExpenseCategory,
  TreasuryMovementDirection,
} from '../common/enums';
import { TreasuryExpense } from '../common/interfaces';
import { computeDebtorBalances } from './treasury-debtor.util';

function loan(name: string, amount: number): TreasuryExpense {
  return {
    id: `loan-${name}-${amount}`,
    direction: TreasuryMovementDirection.EXPENSE,
    category: TreasuryExpenseCategory.LOAN,
    name,
    quantity: 1,
    unitPrice: amount,
    amount,
    occurredAt: '2026-08-01T12:00:00.000Z',
    createdAt: '2026-08-01T12:00:00.000Z',
  };
}

function repayment(name: string, amount: number): TreasuryExpense {
  return {
    id: `repay-${name}-${amount}`,
    direction: TreasuryMovementDirection.INCOME,
    category: TreasuryExpenseCategory.LOAN_REPAYMENT,
    name,
    quantity: 1,
    unitPrice: amount,
    amount,
    occurredAt: '2026-08-02T12:00:00.000Z',
    createdAt: '2026-08-02T12:00:00.000Z',
  };
}

describe('computeDebtorBalances', () => {
  it('agrupa préstamos por persona', () => {
    expect(
      computeDebtorBalances([
        loan('Juan', 5000),
        loan('María', 3000),
        loan('Juan', 2000),
      ]),
    ).toEqual([
      { name: 'Juan', amount: 7000 },
      { name: 'María', amount: 3000 },
    ]);
  });

  it('resta devoluciones parciales', () => {
    expect(
      computeDebtorBalances([
        loan('Juan', 10000),
        repayment('Juan', 4000),
      ]),
    ).toEqual([{ name: 'Juan', amount: 6000 }]);
  });

  it('omite personas saldadas', () => {
    expect(
      computeDebtorBalances([
        loan('Juan', 5000),
        repayment('Juan', 5000),
      ]),
    ).toEqual([]);
  });

  it('unifica nombres sin distinguir mayúsculas', () => {
    expect(
      computeDebtorBalances([
        loan('juan', 1000),
        loan('Juan', 500),
      ]),
    ).toEqual([{ name: 'Juan', amount: 1500 }]);
  });
});
