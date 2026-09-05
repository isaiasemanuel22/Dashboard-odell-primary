import { Injectable } from '@nestjs/common';
import { TreasuryExpense } from '../../common/interfaces';
import { StoreService } from '../store.service';

@Injectable()
export class TreasuryExpenseRepository {
  constructor(private readonly store: StoreService) {}

  findAll(): TreasuryExpense[] {
    return this.store.treasuryExpenses;
  }

  nextId(): string {
    return this.store.nextTreasuryExpenseId();
  }

  create(expense: TreasuryExpense): TreasuryExpense {
    this.store.treasuryExpenses.push(expense);
    return expense;
  }
}
