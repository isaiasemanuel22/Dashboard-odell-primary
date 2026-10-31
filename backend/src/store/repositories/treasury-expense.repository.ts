import { Injectable } from '@nestjs/common';
import { TreasuryExpense } from '../../common/interfaces';
import { StoreService } from '../store.service';

@Injectable()
export class TreasuryExpenseRepository {
  constructor(private readonly store: StoreService) {}

  findAll(): TreasuryExpense[] {
    return this.store.treasuryExpenses;
  }

  findById(id: string): TreasuryExpense | undefined {
    return this.store.treasuryExpenses.find((expense) => expense.id === id);
  }

  nextId(): string {
    return this.store.nextTreasuryExpenseId();
  }

  create(expense: TreasuryExpense): TreasuryExpense {
    this.store.treasuryExpenses.push(expense);
    return expense;
  }

  save(expense: TreasuryExpense): TreasuryExpense {
    const index = this.store.treasuryExpenses.findIndex(
      (item) => item.id === expense.id,
    );
    if (index === -1) {
      this.store.treasuryExpenses.push(expense);
    } else {
      this.store.treasuryExpenses[index] = expense;
    }
    return expense;
  }

  remove(id: string): boolean {
    const index = this.store.treasuryExpenses.findIndex(
      (item) => item.id === id,
    );
    if (index === -1) return false;
    this.store.treasuryExpenses.splice(index, 1);
    return true;
  }
}
